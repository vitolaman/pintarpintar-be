import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMerchantVoucherCodes1788912000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE coupons
      ADD COLUMN name varchar,
      ADD COLUMN description text,
      ADD COLUMN terms text,
      ADD COLUMN starts_at timestamp,
      ADD COLUMN minimum_order_amount numeric,
      ADD COLUMN maximum_discount_amount numeric,
      ADD CONSTRAINT chk_coupons_discount_type
        CHECK (discount_type IN ('percentage', 'nominal')),
      ADD CONSTRAINT chk_coupons_discount_value
        CHECK (discount_value > 0),
      ADD CONSTRAINT chk_coupons_percentage_value
        CHECK (discount_type <> 'percentage' OR discount_value <= 100),
      ADD CONSTRAINT chk_coupons_minimum_order_amount
        CHECK (minimum_order_amount IS NULL OR minimum_order_amount >= 0),
      ADD CONSTRAINT chk_coupons_maximum_discount_amount
        CHECK (maximum_discount_amount IS NULL OR maximum_discount_amount >= 0),
      ADD CONSTRAINT chk_coupons_max_uses
        CHECK (max_uses IS NULL OR max_uses > 0),
      ADD CONSTRAINT chk_coupons_period
        CHECK (starts_at IS NULL OR expires_at IS NULL OR starts_at < expires_at)
    `);

    await queryRunner.query(`
      CREATE TABLE coupon_product_scopes (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_coupons_active_code_ci
      ON coupons (UPPER(code))
      WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX idx_coupons_merchant_created
      ON coupons (merchant_id, created_at DESC)
      WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX idx_coupons_public_discovery
      ON coupons (is_active, starts_at, expires_at, created_at DESC)
      WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_coupon_product_scopes_active_pair
      ON coupon_product_scopes (coupon_id, product_id)
      WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX idx_coupon_product_scopes_product_coupon
      ON coupon_product_scopes (product_id, coupon_id)
      WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX idx_coupon_usages_coupon_active
      ON coupon_usages (coupon_id)
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_coupon_usages_coupon_active');
    await queryRunner.query(
      'DROP INDEX idx_coupon_product_scopes_product_coupon',
    );
    await queryRunner.query('DROP INDEX uq_coupon_product_scopes_active_pair');
    await queryRunner.query('DROP INDEX idx_coupons_public_discovery');
    await queryRunner.query('DROP INDEX idx_coupons_merchant_created');
    await queryRunner.query('DROP INDEX uq_coupons_active_code_ci');
    await queryRunner.query('DROP TABLE coupon_product_scopes');
    await queryRunner.query(`
      ALTER TABLE coupons
      DROP CONSTRAINT chk_coupons_period,
      DROP CONSTRAINT chk_coupons_max_uses,
      DROP CONSTRAINT chk_coupons_maximum_discount_amount,
      DROP CONSTRAINT chk_coupons_minimum_order_amount,
      DROP CONSTRAINT chk_coupons_percentage_value,
      DROP CONSTRAINT chk_coupons_discount_value,
      DROP CONSTRAINT chk_coupons_discount_type,
      DROP COLUMN maximum_discount_amount,
      DROP COLUMN minimum_order_amount,
      DROP COLUMN starts_at,
      DROP COLUMN terms,
      DROP COLUMN description,
      DROP COLUMN name
    `);
  }
}
