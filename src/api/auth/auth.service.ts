import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { DataSource, EntityManager } from 'typeorm';
import { Profile } from '../profile/entities/profile.entity';
import { ChangePasswordDto } from '../user/dto/change-password.dto';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { SignInBodyDto } from './dto/sign-in.req.dto';
import { SignInResDto } from './dto/sign-in.res.dto';
import { SignUpBodyDto } from './dto/sign-up.req.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private userService: UserService,
    private dataSource: DataSource,
  ) {}

  async signUp(body: SignUpBodyDto): Promise<SignInResDto> {
    const user = await this.dataSource.transaction(async (manager) => {
      const createdUser = await this.userService.createWithManager(manager, body);

      await manager.save(
        Profile,
        manager.create(Profile, {
          userId: createdUser.id,
        }),
      );

      return createdUser;
    });

    return this.createTokenResponse(
      'Account Created!',
      user.id,
      user.tokenVersion,
    );
  }

  async signIn(body: SignInBodyDto): Promise<SignInResDto> {
    const user = await this.userService.findForAuthentication(body.email);

    if (!user || !(await compare(body.password, user.passwordHash))) {
      throw new ForbiddenException('invalid username or password');
    }

    return this.createTokenResponse(
      'Login Success',
      user.id,
      user.tokenVersion,
    );
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
      if (!(await compare(input.current_password, user.passwordHash))) {
        throw new BadRequestException('Current password is incorrect');
      }
      if (await compare(input.new_password, user.passwordHash)) {
        throw new BadRequestException(
          'New password must differ from the current password',
        );
      }
      user.passwordHash = await hash(input.new_password, 10);
      user.tokenVersion += 1;
      await manager.save(User, user);
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
    const token = await this.jwtService.signAsync({
      id: userId,
      tv: tokenVersion,
    });

    return new SignInResDto({
      responseMessage,
      data: { token },
    });
  }
}
