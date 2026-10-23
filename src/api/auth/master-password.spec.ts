import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hashPassword } from '~/common/security/password';
import { MasterPassword } from './master-password';

describe('MasterPassword', () => {
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
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('matches nothing and logs nothing when unset', async () => {
    const master = withSetting(undefined);

    await expect(master.matches('master-pass1')).resolves.toBe(false);
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('treats a blank value as unset', async () => {
    await expect(withSetting('  ').matches('')).resolves.toBe(false);
    expect(error).not.toHaveBeenCalled();
  });

  // Values are built lazily: the hash exists only once beforeAll has run.
  it.each([
    ['the password itself', () => 'master-pass1'],
    ['a hash cut by $ interpolation', () => '$2b$10'],
    ['a hash with a character missing', () => hash.slice(0, -1)],
  ])('turns itself off for %s and logs an error', async (_case, valueOf) => {
    const value = valueOf();
    const master = withSetting(value);

    await expect(master.matches('master-pass1')).resolves.toBe(false);
    await expect(master.matches(value)).resolves.toBe(false);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).not.toContain(value);
    expect(warn).not.toHaveBeenCalled();
  });

  it('matches the configured password and warns at startup', async () => {
    const master = withSetting(`${hash}\n`);

    await expect(master.matches('master-pass1')).resolves.toBe(true);
    await expect(master.matches('master-pass2')).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(
      'remove it before production',
    );
    expect(String(warn.mock.calls[0][0])).not.toContain(hash);
  });
});
