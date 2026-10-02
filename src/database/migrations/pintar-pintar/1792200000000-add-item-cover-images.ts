import { MigrationInterface, QueryRunner } from 'typeorm';

const OWNERS = [
  ['class_id', 'classes'],
  ['product_id', 'products'],
  ['bundle_id', 'bundles'],
] as const;

/**
 * Ordered cover images (up to 5) for classes, digital products and bundles.
 * Each item's existing cover becomes its first cover. The items keep
 * cover_asset_id as their main cover. Safe to re-run.
 */
export class AddItemCoverImages1792200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS item_cover_images (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
        product_id uuid REFERENCES products(id) ON DELETE CASCADE,
        bundle_id uuid REFERENCES bundles(id) ON DELETE CASCADE,
        asset_id uuid NOT NULL REFERENCES file_assets(id) ON DELETE CASCADE,
        position smallint NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_item_cover_images_owner CHECK (num_nonnulls(class_id, product_id, bundle_id) = 1),
        CONSTRAINT chk_item_cover_images_position CHECK (position BETWEEN 0 AND 4)
      )
    `);
    for (const [column, table] of OWNERS) {
      const owner = column.replace('_id', '');
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_item_cover_images_${owner}_position
         ON item_cover_images (${column}, position) WHERE ${column} IS NOT NULL AND deleted_at IS NULL`,
      );
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_item_cover_images_${owner}_asset
         ON item_cover_images (${column}, asset_id) WHERE ${column} IS NOT NULL AND deleted_at IS NULL`,
      );
      await queryRunner.query(`
        INSERT INTO item_cover_images (${column}, asset_id, position)
        SELECT item.id, item.cover_asset_id, 0
        FROM ${table} item
        INNER JOIN file_assets asset ON asset.id = item.cover_asset_id AND asset.deleted_at IS NULL
        WHERE NOT EXISTS (
          SELECT 1 FROM item_cover_images cover
          WHERE cover.${column} = item.id AND cover.deleted_at IS NULL)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS item_cover_images');
  }
}
