import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getApps, initializeApp } from 'firebase-admin/app';
import { Auth, DecodedIdToken, getAuth } from 'firebase-admin/auth';

export const GOOGLE_SIGN_IN_FAILED = 'Google sign-in failed';
export const GOOGLE_SIGN_IN_UNAVAILABLE = 'Google sign-in is not available';

/** Firebase Auth for verifying ID tokens, or null when Google sign-in is off. */
export const FIREBASE_AUTH = Symbol('FIREBASE_AUTH');

const FIREBASE_APP_NAME = 'google-sign-in';
const GOOGLE_PROVIDER = 'google.com';

/**
 * Verifying an ID token needs only the project id: the SDK checks it against
 * Google's published keys, so no service-account key is configured.
 */
export const firebaseAuthProvider = {
  provide: FIREBASE_AUTH,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Auth | null => {
    const logger = new Logger('GoogleSignIn');
    const projectId = config.get<string>('FIREBASE_PROJECT_ID')?.trim();
    if (!projectId) {
      logger.warn(
        'FIREBASE_PROJECT_ID is not set: POST /api/v1/auth/google answers 503',
      );
      return null;
    }
    // The SDK accepts unsigned tokens while this variable is set.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      logger.error(
        'FIREBASE_AUTH_EMULATOR_HOST is set: Google sign-in is off, because emulator tokens are unsigned',
      );
      return null;
    }
    const app =
      getApps().find((existing) => existing.name === FIREBASE_APP_NAME) ??
      initializeApp({ projectId }, FIREBASE_APP_NAME);
    return getAuth(app);
  },
};

/** The verified Google account behind a Firebase ID token. */
export type GoogleIdentity = {
  uid: string;
  /** Lowercased. */
  email: string;
  name: string | null;
};

@Injectable()
export class GoogleIdTokenVerifier {
  private readonly logger = new Logger(GoogleIdTokenVerifier.name);

  constructor(@Inject(FIREBASE_AUTH) private readonly auth: Auth | null) {}

  /**
   * Accepts only a valid token of this Firebase project from a Google sign-in
   * with a verified email. Every rejection is the same 403; the log gets a
   * reason code, never the token or the email.
   */
  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.auth) {
      throw new ServiceUnavailableException(GOOGLE_SIGN_IN_UNAVAILABLE);
    }
    let token: DecodedIdToken;
    try {
      token = await this.auth.verifyIdToken(idToken);
    } catch (error) {
      throw this.rejected(verificationFailure(error));
    }
    if (token.firebase?.sign_in_provider !== GOOGLE_PROVIDER) {
      throw this.rejected('provider');
    }
    if (typeof token.email !== 'string' || !token.email.trim()) {
      throw this.rejected('email_missing');
    }
    if (token.email_verified !== true) {
      throw this.rejected('email_unverified');
    }
    return {
      uid: token.uid,
      email: token.email.trim().toLowerCase(),
      name: typeof token.name === 'string' ? token.name : null,
    };
  }

  private rejected(reason: string): ForbiddenException {
    this.logger.warn(`Google sign-in rejected: ${reason}`);
    return new ForbiddenException(GOOGLE_SIGN_IN_FAILED);
  }
}

// The SDK's error code (for example `auth/id-token-expired`); its message can
// quote token claims, so it is not logged.
function verificationFailure(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : 'unknown_error';
}
