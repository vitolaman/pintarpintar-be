import { InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENVELOPE_VERSION = 'v1';
const KEY_ENV = 'PAYOUT_ACCOUNT_ENCRYPTION_KEY';

/**
 * Encrypts bank account numbers with AES-256-GCM when a key is configured. The
 * key is a base64-encoded 32-byte secret, read on use so it only affects payout
 * account endpoints.
 *
 * Encryption is optional (PM decision 2026-09-30: account numbers are not
 * treated as secret). Without a key, numbers are stored as plain text in the
 * ERD `encrypted_account_number` column; `decrypt` returns such values as-is,
 * so they stay readable after a key is added later. A key that is set but
 * malformed is still rejected rather than silently falling back to plain text.
 */
export class AccountNumberCipher {
  constructor(private readonly encodedKey = process.env[KEY_ENV]) {}

  encrypt(accountNumber: string): string {
    if (!this.encodedKey) {
      return accountNumber;
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(accountNumber, 'utf8'),
      cipher.final(),
    ]);

    return [
      ENVELOPE_VERSION,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(storedValue: string): string {
    if (!storedValue.startsWith(`${ENVELOPE_VERSION}:`)) {
      return storedValue;
    }

    const [version, iv, tag, ciphertext] = storedValue.split(':');
    if (version !== ENVELOPE_VERSION || !iv || !tag || !ciphertext) {
      throw new InternalServerErrorException(
        'Unsupported payout account envelope',
      );
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private key(): Buffer {
    const key = this.encodedKey ? Buffer.from(this.encodedKey, 'base64') : null;
    if (!key || key.length !== 32) {
      throw new InternalServerErrorException(
        `Payout account encryption is not configured (${KEY_ENV} must be a base64 32-byte key)`,
      );
    }
    return key;
  }
}

export function maskAccountNumber(accountNumber: string): string {
  return `•••• ${accountNumber.slice(-4)}`;
}
