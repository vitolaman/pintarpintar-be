import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets learners review classes: a review references exactly one class or
 * digital product, and a user reviews a class at most once. Safe to re-run.
 */
export class AddClassReviews1790970000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE reviews
        ADD COLUMN IF NOT EXISTS class_id uuid,
        ALTER COLUMN product_id DROP NOT NULL,
        ALTER COLUMN order_id DROP NOT NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_class_id_fkey') THEN
          ALTER TABLE reviews ADD CONSTRAINT reviews_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_reviews_single_reference') THEN
          ALTER TABLE reviews ADD CONSTRAINT chk_reviews_single_reference
            CHECK (num_nonnulls(product_id, class_id) = 1);
        END IF;
      END $$
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_user_class ON reviews (user_id, class_id) WHERE class_id IS NOT NULL AND deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_reviews_class_active ON reviews (class_id, created_at DESC) WHERE deleted_at IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM reviews WHERE class_id IS NOT NULL OR order_id IS NULL) THEN
          RAISE EXCEPTION 'reviews has class reviews or reviews without orders; remove them before rollback';
        END IF;
      END $$
    `);
    await queryRunner.query('DROP INDEX IF EXISTS idx_reviews_class_active');
    await queryRunner.query('DROP INDEX IF EXISTS uq_reviews_user_class');
    await queryRunner.query(`
      ALTER TABLE reviews
        DROP CONSTRAINT IF EXISTS chk_reviews_single_reference,
        DROP CONSTRAINT IF EXISTS reviews_class_id_fkey,
        DROP COLUMN IF EXISTS class_id,
        ALTER COLUMN product_id SET NOT NULL,
        ALTER COLUMN order_id SET NOT NULL
    `);
  }
}
