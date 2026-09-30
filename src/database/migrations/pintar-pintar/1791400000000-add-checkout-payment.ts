import { MigrationInterface, QueryRunner } from 'typeorm';

const ORDER_STATUSES = ['pending', 'paid', 'expired', 'failed', 'cancelled'];

// Timestamps are stored in UTC; order numbers use the Asia/Jakarta date.
const JAKARTA_CREATED_DATE = `to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD')`;

/**
 * Supports checkout with Duitku: order numbers, the discount code, the
 * payment link and lifecycle times, the settlement date, and each item's
 * code discount share. Earlier orders are numbered in creation order within
 * their Jakarta day. Safe to re-run.
 */
export class AddCheckoutPayment1791400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS order_number varchar(20),
        ADD COLUMN IF NOT EXISTS discount_code_id uuid,
        ADD COLUMN IF NOT EXISTS payment_url text,
        ADD COLUMN IF NOT EXISTS payment_method varchar(20),
        ADD COLUMN IF NOT EXISTS expires_at timestamp,
        ADD COLUMN IF NOT EXISTS paid_at timestamp,
        ADD COLUMN IF NOT EXISTS settlement_date date,
        ADD COLUMN IF NOT EXISTS settled_at timestamp
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_discount_code_id_fkey') THEN
          ALTER TABLE orders ADD CONSTRAINT orders_discount_code_id_fkey
            FOREIGN KEY (discount_code_id) REFERENCES discount_codes(id) ON DELETE SET NULL;
        END IF;
      END $$
    `);

    // Continues each day's sequence after any numbers already assigned.
    await queryRunner.query(`
      WITH day_start AS (
        SELECT substring(order_number FROM 5 FOR 8) AS day,
               max(substring(order_number FROM 14)::integer) AS last_number
        FROM orders WHERE order_number IS NOT NULL
        GROUP BY 1
      ), numbered AS (
        SELECT id, ${JAKARTA_CREATED_DATE} AS day,
               row_number() OVER (PARTITION BY ${JAKARTA_CREATED_DATE} ORDER BY created_at, id) AS position
        FROM orders WHERE order_number IS NULL
      )
      UPDATE orders
      SET order_number = 'ORD-' || numbered.day || '-'
        || lpad((COALESCE(day_start.last_number, 0) + numbered.position)::text, 4, '0')
      FROM numbered
      LEFT JOIN day_start ON day_start.day = numbered.day
      WHERE orders.id = numbered.id
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_order_number ON orders (order_number) WHERE order_number IS NOT NULL',
    );

    const unknownStatuses: Array<{ status: string }> = await queryRunner.query(
      'SELECT DISTINCT status FROM orders WHERE status <> ALL($1::varchar[]) ORDER BY status',
      [ORDER_STATUSES],
    );
    if (unknownStatuses.length > 0) {
      throw new Error(
        `Cannot constrain order statuses: unknown values ${unknownStatuses
          .map((row) => `'${row.status}'`)
          .join(', ')}. Resolve them before migrating.`,
      );
    }
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_status') THEN
          ALTER TABLE orders ADD CONSTRAINT chk_orders_status
            CHECK (status IN (${ORDER_STATUSES.map((status) => `'${status}'`).join(', ')}));
        END IF;
      END $$
    `);

    await queryRunner.query(
      'ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0',
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_items_discount_amount') THEN
          ALTER TABLE order_items ADD CONSTRAINT chk_order_items_discount_amount
            CHECK (discount_amount >= 0 AND discount_amount <= price_at_purchase);
        END IF;
      END $$
    `);

    // One active voucher usage per order; released usages are soft-deleted.
    const [{ duplicates }] = await queryRunner.query(`
      SELECT count(*)::integer AS duplicates FROM (
        SELECT order_id FROM coupon_usages WHERE deleted_at IS NULL
        GROUP BY order_id HAVING count(*) > 1
      ) repeated
    `);
    if (duplicates > 0) {
      throw new Error(
        `Cannot create uq_coupon_usages_order_active: ${duplicates} orders have several active voucher usages. Resolve them before migrating.`,
      );
    }
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_usages_order_active ON coupon_usages (order_id) WHERE deleted_at IS NULL',
    );

    // Expiry sweep, settlement sweep, and the discount-code release lookup.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_orders_pending_expiry ON orders (expires_at) WHERE status = 'pending' AND deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_orders_unsettled ON orders (settlement_date) WHERE status = 'paid' AND settled_at IS NULL AND settlement_date IS NOT NULL`,
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_orders_discount_code ON orders (discount_code_id) WHERE discount_code_id IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_orders_discount_code');
    await queryRunner.query('DROP INDEX IF EXISTS idx_orders_unsettled');
    await queryRunner.query('DROP INDEX IF EXISTS idx_orders_pending_expiry');
    await queryRunner.query(
      'DROP INDEX IF EXISTS uq_coupon_usages_order_active',
    );
    await queryRunner.query(
      'ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_discount_amount',
    );
    await queryRunner.query(
      'ALTER TABLE order_items DROP COLUMN IF EXISTS discount_amount',
    );
    await queryRunner.query(
      'ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status',
    );
    await queryRunner.query('DROP INDEX IF EXISTS uq_orders_order_number');
    await queryRunner.query(
      'ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_discount_code_id_fkey',
    );
    await queryRunner.query(`
      ALTER TABLE orders
        DROP COLUMN IF EXISTS settled_at,
        DROP COLUMN IF EXISTS settlement_date,
        DROP COLUMN IF EXISTS paid_at,
        DROP COLUMN IF EXISTS expires_at,
        DROP COLUMN IF EXISTS payment_method,
        DROP COLUMN IF EXISTS payment_url,
        DROP COLUMN IF EXISTS discount_code_id,
        DROP COLUMN IF EXISTS order_number
    `);
  }
}
