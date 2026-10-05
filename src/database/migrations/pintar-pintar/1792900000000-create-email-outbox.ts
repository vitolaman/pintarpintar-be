import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The queue of automatic emails. Each row is written in the transaction of
 * the event that causes it and sent later by the email job, so an event never
 * waits for or fails on SMTP. Safe to re-run.
 */
export class CreateEmailOutbox1792900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS email_outbox (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        kind varchar(64) NOT NULL,
        recipient_email varchar(255) NOT NULL,
        recipient_user_id uuid,
        dedupe_key varchar(200) NOT NULL,
        payload jsonb NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'pending',
        attempts integer NOT NULL DEFAULT 0,
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        sent_at timestamptz,
        last_error varchar(500),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT uq_email_outbox_dedupe_key UNIQUE (dedupe_key),
        CONSTRAINT chk_email_outbox_status
          CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'discarded')),
        CONSTRAINT chk_email_outbox_attempts CHECK (attempts >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_email_outbox_due ON email_outbox (next_attempt_at)
        WHERE status IN ('pending', 'sending')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS email_outbox');
  }
}
