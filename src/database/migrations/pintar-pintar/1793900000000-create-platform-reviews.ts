import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A store's review of the Pintar Pintar platform: one per store, editable.
 * `user_id` is the owner who saved it last. Safe to re-run.
 */
export class CreatePlatformReviews1793900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_reviews (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL REFERENCES merchants(id),
        user_id uuid NOT NULL REFERENCES users(id),
        rating smallint NOT NULL CONSTRAINT chk_platform_reviews_rating CHECK (rating BETWEEN 1 AND 5),
        comment text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_reviews_merchant
       ON platform_reviews (merchant_id) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_platform_reviews_updated
       ON platform_reviews (updated_at DESC) WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS platform_reviews');
  }
}
