import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The 2.5% platform fee (team decision, 2026-10-13): each merchant chooses
 * who pays it, the merchant by default; each order item keeps its fee and
 * payer as they were at checkout, and each order the part its buyer paid.
 * Existing rows get no fee and their items no payer, so past amounts are
 * unchanged. Safe to re-run.
 */
export class AddPlatformFee1794500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE merchants ADD COLUMN IF NOT EXISTS platform_fee_paid_by varchar(8) NOT NULL DEFAULT 'merchant'`,
    );
    await queryRunner.query(`
      ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS platform_fee_amount numeric NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS platform_fee_paid_by varchar(8)
    `);
    await queryRunner.query(
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee_amount numeric NOT NULL DEFAULT 0',
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_merchants_platform_fee_paid_by') THEN
          ALTER TABLE merchants ADD CONSTRAINT chk_merchants_platform_fee_paid_by
            CHECK (platform_fee_paid_by IN ('buyer', 'merchant'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_items_platform_fee') THEN
          ALTER TABLE order_items ADD CONSTRAINT chk_order_items_platform_fee
            CHECK (platform_fee_amount >= 0
              AND platform_fee_amount <= price_at_purchase - discount_amount
              AND (platform_fee_paid_by IN ('buyer', 'merchant')
                OR (platform_fee_paid_by IS NULL AND platform_fee_amount = 0)));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_platform_fee') THEN
          ALTER TABLE orders ADD CONSTRAINT chk_orders_platform_fee
            CHECK (platform_fee_amount >= 0);
        END IF;
      END $$
    `);
  }

  // Dropping the columns loses recorded fees; wallets credited after the fee
  // started keep their amounts, so roll back only before fee orders exist.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_platform_fee',
    );
    await queryRunner.query(
      'ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_platform_fee',
    );
    await queryRunner.query(
      'ALTER TABLE merchants DROP CONSTRAINT IF EXISTS chk_merchants_platform_fee_paid_by',
    );
    await queryRunner.query(
      'ALTER TABLE orders DROP COLUMN IF EXISTS platform_fee_amount',
    );
    await queryRunner.query(`
      ALTER TABLE order_items
        DROP COLUMN IF EXISTS platform_fee_paid_by,
        DROP COLUMN IF EXISTS platform_fee_amount
    `);
    await queryRunner.query(
      'ALTER TABLE merchants DROP COLUMN IF EXISTS platform_fee_paid_by',
    );
  }
}
