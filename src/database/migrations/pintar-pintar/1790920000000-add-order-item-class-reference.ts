import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets an order item reference a class as well as a digital product, with
 * exactly one reference per item. Safe to re-run.
 */
export class AddOrderItemClassReference1790920000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS class_id uuid
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'order_items_class_id_fkey'
        ) THEN
          ALTER TABLE order_items
          ADD CONSTRAINT order_items_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_items_single_reference'
        ) THEN
          ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
          ALTER TABLE order_items
          ADD CONSTRAINT chk_order_items_single_reference
          CHECK (num_nonnulls(product_id, class_id) = 1);
        END IF;
      END $$
    `);

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_order_items_class ON order_items (class_id) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at DESC) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_merchant_payouts_merchant_requested ON merchant_payouts (merchant_id, requested_at DESC) WHERE deleted_at IS NULL',
    ];
    for (const statement of indexes) {
      await queryRunner.query(statement);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM order_items WHERE class_id IS NOT NULL) THEN
          RAISE EXCEPTION 'order_items has class purchases; they must be removed before rollback';
        END IF;
      END $$
    `);
    for (const name of [
      'idx_merchant_payouts_merchant_requested',
      'idx_orders_status_created',
      'idx_order_items_class',
      'idx_order_items_product',
      'idx_order_items_order',
    ]) {
      await queryRunner.query(`DROP INDEX IF EXISTS ${name}`);
    }
    await queryRunner.query(`
      ALTER TABLE order_items
        DROP CONSTRAINT IF EXISTS chk_order_items_single_reference,
        DROP CONSTRAINT IF EXISTS order_items_class_id_fkey,
        DROP COLUMN IF EXISTS class_id,
        ALTER COLUMN product_id SET NOT NULL
    `);
  }
}
