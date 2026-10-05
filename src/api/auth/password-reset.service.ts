import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';
import {
  queuePasswordChangedEmail,
  queuePasswordResetEmail,
} from '~/api/email/events/account-emails';
import { User } from '../user/entities/user.entity';
import {
  ConfirmPasswordResetDto,
  RequestPasswordResetDto,
} from './dto/password-reset.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';

const TOKEN_LIFETIME_MS = 60 * 60 * 1000;
const RESEND_INTERVAL = "interval '60 seconds'";
const HOURLY_EMAIL_LIMIT = 5;
const TOKEN_RETENTION = "interval '7 days'";
// 32 random bytes in base64url.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export const RESET_REQUESTED =
  'If the email is registered, a reset link has been sent';
export const RESET_LINK_INVALID = 'This reset link is invalid or has expired';
export const PASSWORD_RESET = 'Password reset';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/**
 * Password reset by email link. Requests answer the same way for every
 * address, so they reveal no accounts; only token hashes are stored.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async request(input: RequestPasswordResetDto) {
    const email = input.email.trim().toLowerCase();
    await this.dataSource.transaction(async (manager) => {
      // The row lock serialises requests of one account, so the limits hold.
      const user = await manager.findOne(User, {
        where: { email },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) return;

      // created_at is stored as UTC without a zone.
      const [recent]: Array<{ last_hour: number; too_soon: boolean }> =
        await manager.query(
          `SELECT count(*)::int AS last_hour,
                  COALESCE(bool_or(created_at > (now() AT TIME ZONE 'UTC') - ${RESEND_INTERVAL}), false) AS too_soon
           FROM password_reset_tokens
           WHERE user_id = $1 AND created_at > (now() AT TIME ZONE 'UTC') - interval '1 hour'`,
          [user.id],
        );
      if (recent.too_soon || recent.last_hour >= HOURLY_EMAIL_LIMIT) return;

      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS);
      const saved = await manager.save(
        manager.create(PasswordResetToken, {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt,
        }),
      );
      await queuePasswordResetEmail(manager, {
        tokenId: saved.id,
        token,
        expiresAt,
        user,
      });
    });
    return { data: null, responseMessage: RESET_REQUESTED };
  }

  async confirm(input: ConfirmPasswordResetDto) {
    if (!TOKEN_SHAPE.test(input.token)) {
      throw new BadRequestException(RESET_LINK_INVALID);
    }
    await this.dataSource.transaction(async (manager) => {
      // Locking the token makes concurrent confirms of one link succeed once.
      const [token]: Array<{ user_id: string }> = await manager.query(
        `SELECT token.user_id
         FROM password_reset_tokens token
         INNER JOIN users account ON account.id = token.user_id AND account.deleted_at IS NULL
         WHERE token.token_hash = $1 AND token.used_at IS NULL
           AND token.expires_at > now() AND token.deleted_at IS NULL
         FOR UPDATE OF token`,
        [hashToken(input.token)],
      );
      if (!token) throw new BadRequestException(RESET_LINK_INVALID);

      const user = await manager.findOneOrFail(User, {
        where: { id: token.user_id },
        lock: { mode: 'pessimistic_write' },
      });
      user.passwordHash = await hash(input.new_password, 10);
      // Every issued sign-in token carries the old version and stops working.
      user.tokenVersion += 1;
      await manager.save(User, user);
      await manager.update(
        PasswordResetToken,
        { userId: user.id, usedAt: IsNull() },
        { usedAt: () => 'now()' },
      );
      await queuePasswordChangedEmail(manager, user, { viaReset: true });
    });
    return { data: null, responseMessage: PASSWORD_RESET };
  }

  @Cron('10 3 * * *', { timeZone: 'Asia/Jakarta' })
  async deleteOldTokens(): Promise<number> {
    try {
      const result = await this.dataSource
        .createQueryBuilder()
        .delete()
        .from(PasswordResetToken)
        .where(`created_at < (now() AT TIME ZONE 'UTC') - ${TOKEN_RETENTION}`)
        .execute();
      return result.affected ?? 0;
    } catch (error) {
      this.logger.error(`Reset token cleanup failed: ${error}`);
      return 0;
    }
  }
}
