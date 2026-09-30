import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Standalone merchant bundles of classes and digital products, and bundle
 * purchases as a third order-item reference. Safe to re-run.
 */
export class CreateMerchantBundles1790930000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bundles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL REFERENCES merchants(id),
        title varchar(160) NOT NULL,
        description text NOT NULL,
        cover_asset_id uuid REFERENCES file_assets(id) ON DELETE SET NULL,
        bundle_price numeric NOT NULL,
        post_purchase_instructions text,
        status varchar NOT NULL DEFAULT 'published',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_bundles_price_positive CHECK (bundle_price > 0),
        CONSTRAINT chk_bundles_status CHECK (status IN ('published', 'unpublished', 'unlisted'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS bundle_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        bundle_id uuid NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
        class_id uuid REFERENCES classes(id),
        product_id uuid REFERENCES products(id),
        display_order integer NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_bundle_items_single_reference CHECK (num_nonnulls(class_id, product_id) = 1),
        CONSTRAINT chk_bundle_items_display_order CHECK (display_order >= 0),
        CONSTRAINT uq_bundle_items_class UNIQUE (bundle_id, class_id),
        CONSTRAINT uq_bundle_items_product UNIQUE (bundle_id, product_id),
        CONSTRAINT uq_bundle_items_display_order UNIQUE (bundle_id, display_order)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_bundles_merchant_created ON bundles (merchant_id, created_at DESC) WHERE deleted_at IS NULL',
    );

    await queryRunner.query(`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS bundle_id uuid
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'order_items_bundle_id_fkey'
        ) THEN
          ALTER TABLE order_items
          ADD CONSTRAINT order_items_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES bundles(id);
        END IF;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE order_items
        DROP CONSTRAINT IF EXISTS chk_order_items_single_reference,
        ADD CONSTRAINT chk_order_items_single_reference
          CHECK (num_nonnulls(product_id, class_id, bundle_id) = 1)
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_order_items_bundle ON order_items (bundle_id) WHERE deleted_at IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM order_items WHERE bundle_id IS NOT NULL) THEN
          RAISE EXCEPTION 'order_items has bundle purchases; they must be removed before rollback';
        END IF;
      END $$
    `);
    await queryRunner.query('DROP INDEX IF EXISTS idx_order_items_bundle');
    await queryRunner.query(`
      ALTER TABLE order_items
        DROP CONSTRAINT IF EXISTS chk_order_items_single_reference,
        DROP CONSTRAINT IF EXISTS order_items_bundle_id_fkey,
        DROP COLUMN IF EXISTS bundle_id,
        ADD CONSTRAINT chk_order_items_single_reference
          CHECK (num_nonnulls(product_id, class_id) = 1)
    `);
    await queryRunner.query('DROP TABLE IF EXISTS bundle_items');
    await queryRunner.query('DROP TABLE IF EXISTS bundles');
  }
}
