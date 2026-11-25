import { compare, hash as legacyHash } from 'bcryptjs';
import {
  hashPassword,
  simulatePasswordCheck,
  UNUSABLE_PASSWORD_HASH,
  verifyPassword,
} from './password';

describe('password hashing', () => {
  it('verifies a password stored by bcryptjs', async () => {
    const stored = await legacyHash('Local-pass-1', 10);
    await expect(verifyPassword('Local-pass-1', stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong-pass-1', stored)).resolves.toBe(false);
  });

  it('writes hashes that bcryptjs still accepts, at cost 10', async () => {
    const stored = await hashPassword('Local-pass-1');
    expect(stored).toMatch(/^\$2[aby]\$10\$/);
    await expect(compare('Local-pass-1', stored)).resolves.toBe(true);
    await expect(verifyPassword('Local-pass-1', stored)).resolves.toBe(true);
  });

  it('simulates a check at the cost of new hashes', async () => {
    const stored = await hashPassword('Local-pass-1');
    // Same algorithm prefix and cost, so the comparison takes as long.
    expect(UNUSABLE_PASSWORD_HASH.slice(0, 7)).toBe(stored.slice(0, 7));
    expect(UNUSABLE_PASSWORD_HASH).toMatch(/^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/);
    await expect(simulatePasswordCheck('Local-pass-1')).resolves.toBe(
      undefined,
    );
  });
});
