import { MigrationInterface, QueryRunner } from 'typeorm';

const LEGACY_EMAIL_CONSTRAINT = 'UQ_97672ac88f789774dd47f7c8be3';

/**
 * Supports session revocation (a per-user token version), email reuse after
 * account deletion (uniqueness among active users only, ignoring case), and
 * anonymous feedback (tickets without a user). Safe to re-run.
 */
export class AddAccountExtras1791300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0',
    );

    const [{ duplicates }] = await queryRunner.query(`
      SELECT count(*)::integer AS duplicates FROM (
        SELECT lower(email) FROM users WHERE deleted_at IS NULL
        GROUP BY lower(email) HAVING count(*) > 1
      ) repeated
    `);
    if (duplicates > 0) {
      throw new Error(
        `Cannot make emails case-insensitively unique: ${duplicates} emails are shared by active users. Resolve them before migrating.`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE users DROP CONSTRAINT IF EXISTS "${LEGACY_EMAIL_CONSTRAINT}"`,
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_active ON users (lower(email)) WHERE deleted_at IS NULL',
    );

    await queryRunner.query(
      'ALTER TABLE help_tickets ALTER COLUMN user_id DROP NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Anonymous tickets cannot satisfy NOT NULL; the column stays nullable
    // while any exist.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM help_tickets WHERE user_id IS NULL) THEN
          ALTER TABLE help_tickets ALTER COLUMN user_id SET NOT NULL;
        ELSE
          RAISE NOTICE 'help_tickets.user_id stays nullable: anonymous tickets exist';
        END IF;
      END $$
    `);
    await queryRunner.query('DROP INDEX IF EXISTS uq_users_email_active');
    // Fails when a deleted and an active account now share an email.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${LEGACY_EMAIL_CONSTRAINT}') THEN
          ALTER TABLE users ADD CONSTRAINT "${LEGACY_EMAIL_CONSTRAINT}" UNIQUE (email);
        END IF;
      END $$
    `);
    await queryRunner.query(
      'ALTER TABLE users DROP COLUMN IF EXISTS token_version',
    );
  }
}
