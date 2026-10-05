import { Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { describeFailure } from './email-delivery-rules';
import { EmailOutbox } from './entities/email-outbox.entity';
import type { EmailKind, EmailPayloads } from './templates';

const DAY_MS = 24 * 60 * 60 * 1000;
// An email not sent within this time is dropped instead of arriving late.
export const DEFAULT_EMAIL_LIFETIME_MS = 3 * DAY_MS;
const INSERT_BATCH_SIZE = 500;

export type EmailToQueue = {
  [K in EmailKind]: {
    kind: K;
    to: string;
    userId?: string | null;
    // Names the event; a second email with the same key is never queued.
    dedupeKey: string;
    payload: EmailPayloads[K];
    expiresAt?: Date;
  };
}[EmailKind];

/**
 * Queues emails in the caller's transaction, so they exist exactly when the
 * event is committed. Emails whose key is already queued are skipped.
 */
export async function queueEmails(
  manager: EntityManager,
  emails: EmailToQueue[],
): Promise<void> {
  const now = Date.now();
  const rows = emails
    .filter((email) => email.to?.trim())
    .map((email) => ({
      kind: email.kind,
      recipientEmail: email.to.trim(),
      recipientUserId: email.userId ?? null,
      dedupeKey: email.dedupeKey,
      payload: email.payload as unknown as Record<string, unknown>,
      expiresAt: email.expiresAt ?? new Date(now + DEFAULT_EMAIL_LIFETIME_MS),
    }));
  for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(EmailOutbox)
      .values(rows.slice(start, start + INSERT_BATCH_SIZE))
      .orIgnore()
      .execute();
  }
}

export function queueEmail(
  manager: EntityManager,
  email: EmailToQueue,
): Promise<void> {
  return queueEmails(manager, [email]);
}

const logger = new Logger('EmailQueue');

/**
 * Runs `queue` so that no error in it can fail the event: inside a
 * transaction it runs under a savepoint that is rolled back on error, and
 * outside one it gets its own transaction. Errors are logged, never thrown.
 */
export async function guardEmailQueue(
  manager: EntityManager,
  label: string,
  queue: (manager: EntityManager) => Promise<void>,
): Promise<void> {
  const report = (error: unknown) =>
    logger.error(`Could not queue ${label} email: ${describeFailure(error)}`);
  if (!manager.queryRunner?.isTransactionActive) {
    try {
      await manager.transaction(queue);
    } catch (error) {
      report(error);
    }
    return;
  }
  await manager.query('SAVEPOINT email_queue');
  try {
    await queue(manager);
    await manager.query('RELEASE SAVEPOINT email_queue');
  } catch (error) {
    await manager.query('ROLLBACK TO SAVEPOINT email_queue');
    report(error);
  }
}
