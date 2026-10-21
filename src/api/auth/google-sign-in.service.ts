import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { plainLabel } from '~/common/decorator/input.decorator';
import { ResponseDto } from '~/common/dto/response.dto-default';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import { AuthService } from './auth.service';
import { AuthTokenWithUserDto } from './dto/auth-token-with-user.dto';
import { GoogleSignInBodyDto } from './dto/google-sign-in.req.dto';
import {
  GoogleIdentity,
  GoogleIdTokenVerifier,
} from './google-id-token.verifier';

export const EMAIL_LINKED_TO_OTHER_GOOGLE_ACCOUNT =
  'This email is linked to another Google account';

// The sign-up form's name limit.
const MAX_NAME_LENGTH = 120;
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class GoogleSignInService {
  constructor(
    private readonly verifier: GoogleIdTokenVerifier,
    private readonly authService: AuthService,
    private readonly dataSource: DataSource,
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

  /** The linked account, else the account with that email (linked now), else a new one. */
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

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    error.driverError?.code === UNIQUE_VIOLATION
  );
}
