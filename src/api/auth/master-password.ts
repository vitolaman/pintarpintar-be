import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyPassword } from '~/common/security/password';

// $2a$, $2b$ or $2y$, a two-digit cost, then 53 characters of salt and hash.
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/**
 * One password that signs in to any active account, for development and
 * testing only. MASTER_PASSWORD_HASH holds its bcrypt hash, never the password
 * (`npm run master-password:hash`); unset or invalid, it matches nothing.
 * It must be removed before production.
 */
@Injectable()
export class MasterPassword {
  private readonly logger = new Logger(MasterPassword.name);
  private readonly hash: string | null;

  constructor(config: ConfigService) {
    this.hash = this.readHash(config.get<string>('MASTER_PASSWORD_HASH'));
  }

  matches(password: string): Promise<boolean> {
    if (!this.hash) return Promise.resolve(false);
    return verifyPassword(password, this.hash);
  }

  // Every state logs one startup line, so the log shows whether a deployed
  // image has the setting. An invalid value must not stop the API, so it only
  // turns the feature off.
  private readHash(value: string | undefined): string | null {
    const hash = value?.trim();
    if (!hash) {
      this.logger.log(
        'MASTER_PASSWORD_HASH is not set: master password sign-in is off',
      );
      return null;
    }
    if (!BCRYPT_HASH.test(hash)) {
      this.logger.error(
        'MASTER_PASSWORD_HASH is not a bcrypt hash: master password sign-in is off',
      );
      return null;
    }
    this.logger.warn(
      'MASTER_PASSWORD_HASH is set: master password sign-in is on, for testing only; remove it before production',
    );
    return hash;
  }
}
