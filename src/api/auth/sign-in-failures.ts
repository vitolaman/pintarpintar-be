import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { ThrottlerException } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { TOO_MANY_REQUESTS_MESSAGE } from '~/common/guard/client-address-throttler.guard';

// Failed sign-ins allowed per email in one window, from any address.
export const SIGN_IN_FAILURE_LIMIT = 10;
export const SIGN_IN_FAILURE_WINDOW_SECONDS = 15 * 60;

// Only a hash of the normalized email is stored, so the table holds no
// addresses, also of emails that have no account.
export function signInEmailHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/**
 * Limits failed sign-ins per account across all client addresses, beside the
 * per-address throttles. Each attempt is counted before the password is
 * checked, in one atomic statement, so concurrent guesses cannot pass the
 * limit; a successful sign-in deletes the count, so only failures add up.
 * Unknown emails are counted the same way, so the answer reveals no account.
 * The window starts at the first counted attempt and lasts 15 minutes.
 */
@Injectable()
export class SignInFailures {
  private readonly logger = new Logger(SignInFailures.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Counts an attempt; 429 with the throttle message once over the limit. */
  async countAttempt(email: string): Promise<void> {
    const [row]: Array<{ failure_count: number }> = await this.dataSource.query(
      `INSERT INTO sign_in_failures AS failure (email_hash, failure_count, window_started_at)
       VALUES ($1, 1, now())
       ON CONFLICT (email_hash) DO UPDATE SET
         failure_count = CASE
           WHEN failure.window_started_at <= now() - make_interval(secs => $2) THEN 1
           ELSE failure.failure_count + 1
         END,
         window_started_at = CASE
           WHEN failure.window_started_at <= now() - make_interval(secs => $2) THEN now()
           ELSE failure.window_started_at
         END
       RETURNING failure_count`,
      [signInEmailHash(email), SIGN_IN_FAILURE_WINDOW_SECONDS],
    );
    if (row.failure_count > SIGN_IN_FAILURE_LIMIT) {
      throw new ThrottlerException(TOO_MANY_REQUESTS_MESSAGE);
    }
  }

  async clear(email: string): Promise<void> {
    await this.dataSource.query(
      'DELETE FROM sign_in_failures WHERE email_hash = $1',
      [signInEmailHash(email)],
    );
  }

  // Windows that have ended no longer limit anything.
  @Cron(CronExpression.EVERY_HOUR)
  async deleteEndedWindows(): Promise<number> {
    try {
      const [, affected] = await this.dataSource.query(
        `DELETE FROM sign_in_failures
         WHERE window_started_at <= now() - make_interval(secs => $1)`,
        [SIGN_IN_FAILURE_WINDOW_SECONDS],
      );
      return affected ?? 0;
    } catch (error) {
      this.logger.error(`Sign-in failure cleanup failed: ${error}`);
      return 0;
    }
  }
}
