import { ConfigService } from '@nestjs/config';
import { adminUserIds, isAdminUser } from './admin-users';

const configWith = (value: string | undefined) =>
  ({ get: jest.fn().mockReturnValue(value) }) as unknown as ConfigService;

describe('admin users', () => {
  it('parses a comma-separated list, trimmed and lowercased', () => {
    expect(adminUserIds(configWith(' user-1 , USER-2 ,, '))).toEqual([
      'user-1',
      'user-2',
    ]);
  });

  it.each([[undefined], [''], [' , ']])(
    'has no admins when ADMIN_USER_IDS is %j',
    (value) => {
      expect(adminUserIds(configWith(value))).toEqual([]);
      expect(isAdminUser(configWith(value), 'user-1')).toBe(false);
    },
  );

  it('matches the full id, ignoring case', () => {
    const config = configWith('user-1,USER-2');
    expect(isAdminUser(config, 'USER-1')).toBe(true);
    expect(isAdminUser(config, 'user-2')).toBe(true);
    expect(isAdminUser(config, 'user')).toBe(false);
  });

  it.each([[null], [undefined], ['']])('is never true for %j', (userId) => {
    expect(isAdminUser(configWith('user-1'), userId)).toBe(false);
  });
});
