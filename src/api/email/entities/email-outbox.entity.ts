import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

export const emailStatuses = [
  'pending',
  'sending',
  'sent',
  'failed',
  'discarded',
] as const;
export type EmailStatus = (typeof emailStatuses)[number];

/** One automatic email, queued with the event that caused it. */
@Entity({ name: 'email_outbox' })
export class EmailOutbox extends BaseEntity {
  @Column({ type: 'varchar', length: 64 })
  kind: string;

  @Column({ name: 'recipient_email', type: 'varchar', length: 255 })
  recipientEmail: string;

  // No foreign key: deleting an account must never be blocked by its mail.
  @Column({ name: 'recipient_user_id', type: 'uuid', nullable: true })
  recipientUserId: string | null;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 200 })
  dedupeKey: string;

  // The data the template shows, captured when the email was queued.
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: EmailStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'next_attempt_at', type: 'timestamptz' })
  nextAttemptAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  // SMTP code and a short reason only; never credentials or message bodies.
  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;
}
