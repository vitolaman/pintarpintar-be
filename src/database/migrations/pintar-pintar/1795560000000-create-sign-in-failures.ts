import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Failed sign-ins per account (SignInFailures). Keyed by a SHA-256 hash of the
 * normalized email, so the table holds no addresses. Rows are short-lived: a
 * successful sign-in deletes its row and an hourly job deletes ended windows.
 * Safe to re-run.
 */
export class CreateSignInFailures1795560000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sign_in_failures (
        email_hash char(64) PRIMARY KEY,
        failure_count integer NOT NULL,
        window_started_at timestamptz NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS sign_in_failures');
  }
}
