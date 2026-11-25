import { ConfigService } from '@nestjs/config';

/**
 * User ids listed in ADMIN_USER_IDS (comma-separated, case-insensitive).
 * Unset or empty means no admins, so admin access fails closed.
 */
export const adminUserIds = (config: ConfigService): string[] =>
  (config.get<string>('ADMIN_USER_IDS') ?? '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

export const isAdminUser = (
  config: ConfigService,
  userId: string | null | undefined,
): boolean =>
  typeof userId === 'string' &&
  userId !== '' &&
  adminUserIds(config).includes(userId.toLowerCase());
