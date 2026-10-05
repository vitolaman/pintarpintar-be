import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Single-use password reset tokens. Only a SHA-256 hash of each token is
 * stored, so the table holds no usable link. Safe to re-run.
 */
export class CreatePasswordResetTokens1793000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT uq_password_reset_tokens_hash UNIQUE (token_hash)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens (user_id, created_at)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS password_reset_tokens');
  }
}
