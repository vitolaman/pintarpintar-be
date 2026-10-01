import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records one visit per merchant, visitor and Asia/Jakarta day, the
 * denominator of the merchant analytics conversion rate. Safe to re-run.
 */
export class AddMerchantVisits1791800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS merchant_visits (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL REFERENCES merchants(id),
        visitor_key varchar(64) NOT NULL,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        visit_date date NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_merchant_visits_daily') THEN
          ALTER TABLE merchant_visits ADD CONSTRAINT uq_merchant_visits_daily
            UNIQUE (merchant_id, visitor_key, visit_date);
        END IF;
      END $$
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_merchant_visits_merchant_date ON merchant_visits (merchant_id, visit_date)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS merchant_visits');
  }
}
