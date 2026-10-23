import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '~/common/security/password';
import { DataSource, EntityManager } from 'typeorm';
import { ResponseDto } from '~/common/dto/response.dto-default';
import { Profile } from '../profile/entities/profile.entity';
import { ChangePasswordDto } from '../user/dto/change-password.dto';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { AuthTokenWithUserDto } from './dto/auth-token-with-user.dto';
import { SignInBodyDto } from './dto/sign-in.req.dto';
import { SignInResDto } from './dto/sign-in.res.dto';
import { SignUpBodyDto } from './dto/sign-up.req.dto';
import { queuePasswordChangedEmail } from '~/api/email/events/account-emails';
import { MasterPassword } from './master-password';

export const NO_PASSWORD_YET =
  'This account has no password yet; use password reset to add one';

// Testing sessions opened with the master password end sooner than normal ones.
const MASTER_PASSWORD_SESSION = '1h';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private userService: UserService,
    private dataSource: DataSource,
    private masterPassword: MasterPassword,
  ) {}

  async signUp(
    body: SignUpBodyDto,
  ): Promise<ResponseDto<AuthTokenWithUserDto>> {
    const user = await this.dataSource.transaction(async (manager) => {
      const createdUser = await this.userService.createWithManager(
        manager,
        body,
      );

      await manager.save(
        Profile,
        manager.create(Profile, {
          userId: createdUser.id,
        }),
      );

      return createdUser;
    });

    return this.createSignedInResponse(
      'Account Created!',
      user.id,
      user.tokenVersion,
    );
  }

  async signIn(
    body: SignInBodyDto,
  ): Promise<ResponseDto<AuthTokenWithUserDto>> {
    const user = await this.userService.findForAuthentication(body.email);
    if (!user) throw new ForbiddenException('invalid username or password');

    // An account created through Google has no password yet.
    if (
      user.passwordHash &&
      (await verifyPassword(body.password, user.passwordHash))
    ) {
      return this.createSignedInResponse(
        'Login Success',
        user.id,
        user.tokenVersion,
      );
    }

    // The user id is enough to trace a use; the email and address are
    // personal data and stay out of the log.
    if (await this.masterPassword.matches(body.password)) {
      this.logger.warn(`Master password sign-in for user ${user.id}`);
      return this.createSignedInResponse(
        'Login Success',
        user.id,
        user.tokenVersion,
        MASTER_PASSWORD_SESSION,
      );
    }

    throw new ForbiddenException('invalid username or password');
  }

  // Signs every other session out: tokens carry the version they were issued
  // under, and the guard rejects older ones. The caller gets a fresh token.
  async endOtherSessions(userId: string): Promise<SignInResDto> {
    const version = await this.dataSource.transaction((manager) =>
      this.raiseTokenVersion(manager, userId),
    );
    return this.createTokenResponse('Other sessions ended', userId, version);
  }

  // A wrong current password is 400, not 401, so the client keeps its session.
  // The new password also ends every other session.
  async changePassword(
    userId: string,
    input: ChangePasswordDto,
  ): Promise<SignInResDto> {
    const version = await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new UnauthorizedException();
      if (!user.passwordHash) {
        throw new BadRequestException(NO_PASSWORD_YET);
      }
      if (!(await verifyPassword(input.current_password, user.passwordHash))) {
        throw new BadRequestException('Current password is incorrect');
      }
      if (await verifyPassword(input.new_password, user.passwordHash)) {
        throw new BadRequestException(
          'New password must differ from the current password',
        );
      }
      user.passwordHash = await hashPassword(input.new_password);
      user.tokenVersion += 1;
      await manager.save(User, user);
      await queuePasswordChangedEmail(manager, user);
      return user.tokenVersion;
    });
    return this.createTokenResponse('Password changed', userId, version);
  }

  async raiseTokenVersion(
    manager: EntityManager,
    userId: string,
  ): Promise<number> {
    const user = await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) throw new UnauthorizedException();
    user.tokenVersion += 1;
    await manager.save(User, user);
    return user.tokenVersion;
  }

  async createTokenResponse(
    responseMessage: string,
    userId: string,
    tokenVersion = 0,
  ): Promise<SignInResDto> {
    const token = await this.signToken(userId, tokenVersion);

    return new SignInResDto({
      responseMessage,
      data: { token },
    });
  }

  async createSignedInResponse(
    responseMessage: string,
    userId: string,
    tokenVersion: number,
    expiresIn?: string,
  ): Promise<ResponseDto<AuthTokenWithUserDto>> {
    const [token, user] = await Promise.all([
      this.signToken(userId, tokenVersion, expiresIn),
      this.userService.findCurrentUser(userId),
    ]);

    return new ResponseDto({ responseMessage, data: { token, user } });
  }

  // Without expiresIn, the token lasts JWT_EXPIRES.
  private signToken(
    userId: string,
    tokenVersion: number,
    expiresIn?: string,
  ): Promise<string> {
    const payload = { id: userId, tv: tokenVersion };
    if (!expiresIn) return this.jwtService.signAsync(payload);
    return this.jwtService.signAsync(payload, { expiresIn });
  }
}
