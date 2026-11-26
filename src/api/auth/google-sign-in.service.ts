import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { plainLabel } from '~/common/decorator/input.decorator';
import { ResponseDto } from '~/common/dto/response.dto-default';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import { AuthService, INVALID_CREDENTIALS } from './auth.service';
import { AuthTokenWithUserDto } from './dto/auth-token-with-user.dto';
import { GoogleLinkBodyDto } from './dto/google-link.req.dto';
import { GoogleSignInBodyDto } from './dto/google-sign-in.req.dto';
import {
  GoogleIdentity,
  GoogleIdTokenVerifier,
} from './google-id-token.verifier';
import { SignInFailures } from './sign-in-failures';

export const EMAIL_LINKED_TO_OTHER_GOOGLE_ACCOUNT =
  'This email is linked to another Google account';
export const PASSWORD_ACCOUNT_EXISTS = 'PASSWORD_ACCOUNT_EXISTS';
export const PASSWORD_ACCOUNT_EXISTS_MESSAGE =
  'This email is registered with a password. Confirm the password to link Google, sign in with the password, or reset it.';
export const NO_ACCOUNT_TO_LINK = 'No account with this email to link';
export const GOOGLE_ALREADY_LINKED = 'GOOGLE_ALREADY_LINKED';
export const GOOGLE_ALREADY_LINKED_MESSAGE =
  'This account is already linked to this Google account. Sign in with Google.';
export const GOOGLE_ACCOUNT_LINKED_ELSEWHERE =
  'GOOGLE_ACCOUNT_LINKED_ELSEWHERE';
export const GOOGLE_ACCOUNT_LINKED_ELSEWHERE_MESSAGE =
  'This Google account is linked to another account';

// The sign-up form's name limit.
const MAX_NAME_LENGTH = 120;
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class GoogleSignInService {
  constructor(
    private readonly verifier: GoogleIdTokenVerifier,
    private readonly authService: AuthService,
    private readonly dataSource: DataSource,
    private readonly signInFailures: SignInFailures,
  ) {}

  async signIn(
    body: GoogleSignInBodyDto,
  ): Promise<ResponseDto<AuthTokenWithUserDto>> {
    const identity = await this.verifier.verify(body.id_token);
    const user = await this.findOrCreateAccount(identity);
    return this.authService.createSignedInResponse(
      'Login Success',
      user.id,
      user.tokenVersion,
    );
  }

  /**
   * Links Google to the password account with the token's email once its
   * password is confirmed, then signs in like `signIn`. The password check is
   * sign-in's: the same per-email failure limit (shared with sign-in), the
   * same cost for an account without a password, the same 403. The master
   * password never links: linking changes the account for good. The row lock
   * makes two concurrent links of one account run one after the other; the
   * second sees the link and gets 409.
   */
  async link(
    body: GoogleLinkBodyDto,
  ): Promise<ResponseDto<AuthTokenWithUserDto>> {
    const identity = await this.verifier.verify(body.id_token);
    await this.signInFailures.countAttempt(identity.email);
    let user: User;
    try {
      user = await this.dataSource.transaction((manager) =>
        this.linkAccount(manager, identity, body.password),
      );
    } catch (error) {
      // A concurrent link of this Google account to another account won.
      if (isUniqueViolation(error)) throw googleAccountLinkedElsewhere();
      throw error;
    }
    await this.signInFailures.clear(identity.email);
    return this.authService.createSignedInResponse(
      'Login Success',
      user.id,
      user.tokenVersion,
    );
  }

  private async linkAccount(
    manager: EntityManager,
    identity: GoogleIdentity,
    password: string,
  ): Promise<User> {
    const account = await manager.findOne(User, {
      where: { email: identity.email },
      lock: { mode: 'pessimistic_write' },
    });
    if (!account) {
      await this.authService.matchesOwnPassword(null, password);
      throw new NotFoundException(NO_ACCOUNT_TO_LINK);
    }
    if (account.firebaseUid === identity.uid) {
      throw new ConflictException({
        message: GOOGLE_ALREADY_LINKED_MESSAGE,
        details: { code: GOOGLE_ALREADY_LINKED },
      });
    }
    if (account.firebaseUid) {
      throw new ConflictException(EMAIL_LINKED_TO_OTHER_GOOGLE_ACCOUNT);
    }
    const uidOwner = await manager.findOneBy(User, {
      firebaseUid: identity.uid,
    });
    if (uidOwner) throw googleAccountLinkedElsewhere();

    if (!(await this.authService.matchesOwnPassword(account, password))) {
      throw new ForbiddenException(INVALID_CREDENTIALS);
    }
    await manager.update(
      User,
      { id: account.id },
      { firebaseUid: identity.uid },
    );
    return account;
  }

  // Two first sign-ins at once: one insert hits a unique index (email or
  // Firebase user) and its retry finds the account the other one created.
  private async findOrCreateAccount(identity: GoogleIdentity): Promise<User> {
    try {
      return await this.dataSource.transaction((manager) =>
        this.resolveAccount(manager, identity),
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return this.dataSource.transaction((manager) =>
        this.resolveAccount(manager, identity),
      );
    }
  }

  /**
   * The linked account; else the account with that email when it has no
   * password (linked now); else a new account. An unlinked account with a
   * password is refused: emails are not verified at sign-up, so its password
   * may belong to someone who registered another person's email first; the
   * person links it with `link`, which asks for that password.
   */
  private async resolveAccount(
    manager: EntityManager,
    identity: GoogleIdentity,
  ): Promise<User> {
    const linked = await manager.findOneBy(User, {
      firebaseUid: identity.uid,
    });
    if (linked) return linked;

    // Locked, so a concurrent link of the same account is seen here.
    const sameEmail = await manager.findOne(User, {
      where: { email: identity.email },
      lock: { mode: 'pessimistic_write' },
    });
    if (sameEmail) {
      if (sameEmail.firebaseUid && sameEmail.firebaseUid !== identity.uid) {
        throw new ConflictException(EMAIL_LINKED_TO_OTHER_GOOGLE_ACCOUNT);
      }
      if (!sameEmail.firebaseUid && sameEmail.passwordHash) {
        throw new ConflictException({
          message: PASSWORD_ACCOUNT_EXISTS_MESSAGE,
          details: { code: PASSWORD_ACCOUNT_EXISTS },
        });
      }
      if (!sameEmail.firebaseUid) {
        await manager.update(
          User,
          { id: sameEmail.id },
          { firebaseUid: identity.uid },
        );
      }
      return sameEmail;
    }

    const created = await manager.save(
      User,
      manager.create(User, {
        name: googleAccountName(identity),
        email: identity.email,
        passwordHash: null,
        firebaseUid: identity.uid,
      }),
    );
    await manager.save(
      Profile,
      manager.create(Profile, { userId: created.id }),
    );
    return created;
  }
}

/** The Google profile name as plain text, else the email before `@`. */
export function googleAccountName(identity: GoogleIdentity): string {
  const profileName = identity.name ? plainLabel(identity.name) : '';
  const name = profileName || identity.email.split('@')[0];
  return Array.from(name).slice(0, MAX_NAME_LENGTH).join('').trim();
}

function googleAccountLinkedElsewhere(): ConflictException {
  return new ConflictException({
    message: GOOGLE_ACCOUNT_LINKED_ELSEWHERE_MESSAGE,
    details: { code: GOOGLE_ACCOUNT_LINKED_ELSEWHERE },
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    error.driverError?.code === UNIQUE_VIOLATION
  );
}
