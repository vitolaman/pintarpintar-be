import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Google sign-in (change add-google-sign-in): accounts created through Google
 * have no password, and each account may be linked to one Firebase user.
 * Existing rows are unchanged. Safe to re-run.
 */
export class AddGoogleSignIn1795100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid varchar(128)',
    );
    // A deleted account keeps its link, so a later Google sign-in creates a
    // new account instead of failing.
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_users_firebase_uid_active ON users (firebase_uid) WHERE deleted_at IS NULL AND firebase_uid IS NOT NULL',
    );
  }

  // Accounts without a password cannot be given one here, so the rollback
  // stops instead of inventing a password.
  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }]: Array<{ count: string }> = await queryRunner.query(
      'SELECT count(*) FROM users WHERE password_hash IS NULL',
    );
    if (Number(count) > 0) {
      throw new Error(
        `${count} accounts have no password; set or delete them before reverting AddGoogleSignIn1795100000000`,
      );
    }
    await queryRunner.query(
      'DROP INDEX IF EXISTS uq_users_firebase_uid_active',
    );
    await queryRunner.query(
      'ALTER TABLE users DROP COLUMN IF EXISTS firebase_uid',
    );
    await queryRunner.query(
      'ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL',
    );
  }
}
