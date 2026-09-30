import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Internal merchant discounts with optional product targets and generated
 * codes. Safe to re-run.
 */
export class CreateMerchantDiscounts1790950000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS discounts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL REFERENCES merchants(id),
        name varchar(120) NOT NULL,
        discount_type varchar NOT NULL,
        discount_value numeric NOT NULL,
        minimum_purchase numeric,
        starts_at timestamp,
        ends_at timestamp,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_discounts_type CHECK (discount_type IN ('percentage', 'nominal')),
        CONSTRAINT chk_discounts_value CHECK (discount_value > 0),
        CONSTRAINT chk_discounts_percentage_value CHECK (discount_type <> 'percentage' OR discount_value <= 100),
        CONSTRAINT chk_discounts_minimum_purchase CHECK (minimum_purchase IS NULL OR minimum_purchase >= 0),
        CONSTRAINT chk_discounts_period CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS discount_products (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        discount_id uuid NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
        class_id uuid REFERENCES classes(id),
        product_id uuid REFERENCES products(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_discount_products_single_reference CHECK (num_nonnulls(class_id, product_id) = 1),
        CONSTRAINT uq_discount_products_class UNIQUE (discount_id, class_id),
        CONSTRAINT uq_discount_products_product UNIQUE (discount_id, product_id)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS discount_codes (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        discount_id uuid NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
        code varchar(32) NOT NULL,
        code_type varchar NOT NULL,
        usage_limit integer NOT NULL,
        used_count integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_discount_codes_type CHECK (code_type IN ('once', 'recurring')),
        CONSTRAINT chk_discount_codes_usage_limit CHECK (usage_limit BETWEEN 1 AND 100000),
        CONSTRAINT chk_discount_codes_used_count CHECK (used_count >= 0 AND used_count <= usage_limit)
      )
    `);

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_discounts_merchant_created ON discounts (merchant_id, created_at DESC) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_discount_codes_discount ON discount_codes (discount_id) WHERE deleted_at IS NULL',
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_discount_codes_active_code_ci ON discount_codes (upper(code)) WHERE deleted_at IS NULL',
    ];
    for (const statement of indexes) {
      await queryRunner.query(statement);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS discount_codes');
    await queryRunner.query('DROP TABLE IF EXISTS discount_products');
    await queryRunner.query('DROP TABLE IF EXISTS discounts');
  }
}
