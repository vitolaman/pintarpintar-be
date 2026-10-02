import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the monthly merchant level evaluation: when each merchant's tracking
 * started, and one evaluation row per merchant and month. Existing merchants
 * start tracking at deploy, so months before the rules existed never count.
 * Also widens digital_files.file_size to bigint, since level limits allow
 * product files up to 10 GB (integer stops at 2 GiB). Safe to re-run.
 */
export class AddMerchantLevels1792100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE merchants ADD COLUMN IF NOT EXISTS level_tracked_from timestamp NOT NULL DEFAULT now()',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS merchant_level_evaluations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        period_month date NOT NULL,
        revenue numeric NOT NULL,
        previous_month_revenue numeric NOT NULL,
        previous_level merchant_storage_level_enum NOT NULL,
        new_level merchant_storage_level_enum NOT NULL,
        inactivity_action varchar(16) NOT NULL DEFAULT 'none',
        removed_items integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_merchant_level_evaluations_month CHECK (extract(day FROM period_month) = 1),
        CONSTRAINT chk_merchant_level_evaluations_action CHECK (inactivity_action IN ('none', 'warning', 'removed')),
        CONSTRAINT chk_merchant_level_evaluations_removed CHECK (removed_items >= 0)
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_merchant_level_evaluations_month') THEN
          ALTER TABLE merchant_level_evaluations ADD CONSTRAINT uq_merchant_level_evaluations_month
            UNIQUE (merchant_id, period_month);
        END IF;
      END $$
    `);
    await queryRunner.query(
      'ALTER TABLE digital_files ALTER COLUMN file_size TYPE bigint',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM digital_files WHERE file_size > 2147483647) THEN
          ALTER TABLE digital_files ALTER COLUMN file_size TYPE integer;
        END IF;
      END $$
    `);
    await queryRunner.query('DROP TABLE IF EXISTS merchant_level_evaluations');
    await queryRunner.query(
      'ALTER TABLE merchants DROP COLUMN IF EXISTS level_tracked_from',
    );
  }
}
