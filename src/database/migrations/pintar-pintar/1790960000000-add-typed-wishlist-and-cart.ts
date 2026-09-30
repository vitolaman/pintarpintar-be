import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets the wishlist reference classes and bundles as well as digital
 * products, and adds a typed one-per-item cart. Safe to re-run.
 */
export class AddTypedWishlistAndCart1790960000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE wishlist
        ADD COLUMN IF NOT EXISTS class_id uuid,
        ADD COLUMN IF NOT EXISTS bundle_id uuid,
        ALTER COLUMN product_id DROP NOT NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wishlist_class_id_fkey') THEN
          ALTER TABLE wishlist ADD CONSTRAINT wishlist_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wishlist_bundle_id_fkey') THEN
          ALTER TABLE wishlist ADD CONSTRAINT wishlist_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES bundles(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wishlist_single_reference') THEN
          ALTER TABLE wishlist ADD CONSTRAINT chk_wishlist_single_reference
            CHECK (num_nonnulls(product_id, class_id, bundle_id) = 1);
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        class_id uuid REFERENCES classes(id),
        product_id uuid REFERENCES products(id),
        bundle_id uuid REFERENCES bundles(id),
        added_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_cart_items_single_reference CHECK (num_nonnulls(product_id, class_id, bundle_id) = 1)
      )
    `);

    const indexes = [
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_wishlist_user_class ON wishlist (user_id, class_id) WHERE class_id IS NOT NULL',
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_wishlist_user_bundle ON wishlist (user_id, bundle_id) WHERE bundle_id IS NOT NULL',
      'CREATE INDEX IF NOT EXISTS idx_wishlist_user_added ON wishlist (user_id, added_at DESC) WHERE deleted_at IS NULL',
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_user_class ON cart_items (user_id, class_id) WHERE class_id IS NOT NULL AND deleted_at IS NULL',
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_user_product ON cart_items (user_id, product_id) WHERE product_id IS NOT NULL AND deleted_at IS NULL',
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_user_bundle ON cart_items (user_id, bundle_id) WHERE bundle_id IS NOT NULL AND deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders (user_id, created_at DESC) WHERE deleted_at IS NULL',
    ];
    for (const statement of indexes) {
      await queryRunner.query(statement);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM wishlist WHERE product_id IS NULL) THEN
          RAISE EXCEPTION 'wishlist has class or bundle entries; remove them before rollback';
        END IF;
      END $$
    `);
    await queryRunner.query('DROP INDEX IF EXISTS idx_orders_user_created');
    await queryRunner.query('DROP TABLE IF EXISTS cart_items');
    await queryRunner.query('DROP INDEX IF EXISTS idx_wishlist_user_added');
    await queryRunner.query('DROP INDEX IF EXISTS uq_wishlist_user_bundle');
    await queryRunner.query('DROP INDEX IF EXISTS uq_wishlist_user_class');
    await queryRunner.query(`
      ALTER TABLE wishlist
        DROP CONSTRAINT IF EXISTS chk_wishlist_single_reference,
        DROP CONSTRAINT IF EXISTS wishlist_bundle_id_fkey,
        DROP CONSTRAINT IF EXISTS wishlist_class_id_fkey,
        DROP COLUMN IF EXISTS bundle_id,
        DROP COLUMN IF EXISTS class_id,
        ALTER COLUMN product_id SET NOT NULL
    `);
  }
}
