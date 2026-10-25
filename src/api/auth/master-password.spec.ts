import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFileSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { hashPassword } from '~/common/security/password';
import { MasterPassword } from './master-password';

describe('MasterPassword', () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  let hash: string;

  const withSetting = (value: string | undefined) =>
    new MasterPassword({
      get: jest.fn().mockReturnValue(value),
    } as unknown as ConfigService);

  beforeAll(async () => {
    hash = await hashPassword('master-pass1');
  });

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('matches nothing and logs that it is off when unset', async () => {
    const master = withSetting(undefined);

    await expect(master.matches('master-pass1')).resolves.toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      'MASTER_PASSWORD_HASH is not set: master password sign-in is off',
    );
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  // .env.example ships the setting blank, which means off.
  it('treats a blank value as unset', async () => {
    await expect(withSetting('  ').matches('')).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith(
      'MASTER_PASSWORD_HASH is not set: master password sign-in is off',
    );
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  // Values are built lazily: the hash exists only once beforeAll has run.
  it.each([
    ['the password itself', () => 'master-pass1'],
    ['a hash cut by $ interpolation', () => '$2b$10'],
    ['a hash with a character missing', () => hash.slice(0, -1)],
    [
      'base64url of something else',
      () => Buffer.from('not a hash').toString('base64url'),
    ],
  ])('turns itself off for %s and logs an error', async (_case, valueOf) => {
    const value = valueOf();
    const master = withSetting(value);

    await expect(master.matches('master-pass1')).resolves.toBe(false);
    await expect(master.matches(value)).resolves.toBe(false);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).not.toContain(value);
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('accepts the hash base64url-encoded, as the script writes it', async () => {
    const master = withSetting(Buffer.from(hash).toString('base64url'));

    await expect(master.matches('master-pass1')).resolves.toBe(true);
    await expect(master.matches('master-pass2')).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  // The application loads .env through dotenv-expand before ConfigModule
  // (src/database/database.data-source.ts), which empties a plain hash.
  describe('through the .env loading of the application', () => {
    let dir: string;
    const loadEnvLine = (line: string) => {
      const path = join(dir, '.env');
      writeFileSync(path, `${line}\n`);
      delete process.env.MASTER_PASSWORD_HASH;
      dotenvExpand.expand(dotenv.config({ path }));
      return new MasterPassword({
        get: (key: string) => process.env[key],
      } as unknown as ConfigService);
    };

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'master-password-'));
    });

    afterEach(() => {
      delete process.env.MASTER_PASSWORD_HASH;
      rmSync(dir, { recursive: true, force: true });
    });

    it('keeps the line printed by npm run master-password:hash', async () => {
      const line = execFileSync(
        process.execPath,
        ['scripts/master-password-hash.cjs'],
        { input: 'master-pass-123\n' },
      )
        .toString()
        .trim();
      expect(line).toMatch(/^MASTER_PASSWORD_HASH=[A-Za-z0-9_-]+$/);

      const master = loadEnvLine(line);

      await expect(master.matches('master-pass-123')).resolves.toBe(true);
      await expect(master.matches('master-pass-124')).resolves.toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    // Expansion drops each `$` and the letters and digits after it, so what is
    // left is empty or a fragment, depending on the hash.
    it('loses a plain hash, even single-quoted, to $ expansion', async () => {
      const master = loadEnvLine(`MASTER_PASSWORD_HASH='${hash}'`);

      expect(process.env.MASTER_PASSWORD_HASH).not.toContain('$');
      await expect(master.matches('master-pass1')).resolves.toBe(false);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('matches the configured password and warns at startup', async () => {
    const master = withSetting(`${hash}\n`);

    await expect(master.matches('master-pass1')).resolves.toBe(true);
    await expect(master.matches('master-pass2')).resolves.toBe(false);
    expect(log).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(
      'remove it before production',
    );
    expect(String(warn.mock.calls[0][0])).not.toContain(hash);
  });
});
