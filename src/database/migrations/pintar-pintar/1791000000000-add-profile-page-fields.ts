import { MigrationInterface, QueryRunner } from 'typeorm';

const UUID_PATTERN =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

/**
 * Stores the merchant landing page background and layout, and turns
 * discussion author ids into real user references. Safe to re-run.
 */
export class AddProfilePageFields1791000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE merchant_profiles
        ADD COLUMN IF NOT EXISTS landing_background_asset_id uuid,
        ADD COLUMN IF NOT EXISTS landing_layout jsonb
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merchant_profiles_landing_background_asset_id_fkey') THEN
          ALTER TABLE merchant_profiles ADD CONSTRAINT merchant_profiles_landing_background_asset_id_fkey
            FOREIGN KEY (landing_background_asset_id) REFERENCES file_assets(id) ON DELETE SET NULL;
        END IF;
      END $$
    `);

    for (const table of ['discussion_threads', 'comments']) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM ${table} WHERE author_id::text !~ '${UUID_PATTERN}') THEN
            RAISE EXCEPTION '${table}.author_id has values that are not user ids';
          END IF;
          IF (SELECT data_type FROM information_schema.columns
              WHERE table_name = '${table}' AND column_name = 'author_id') <> 'uuid' THEN
            ALTER TABLE ${table} ALTER COLUMN author_id TYPE uuid USING author_id::uuid;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${table}_author_id_fkey') THEN
            ALTER TABLE ${table} ADD CONSTRAINT ${table}_author_id_fkey
              FOREIGN KEY (author_id) REFERENCES users(id);
          END IF;
        END $$
      `);
    }
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_discussion_threads_class_active ON discussion_threads (class_id, created_at DESC) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_comments_thread_active ON comments (thread_id, created_at) WHERE deleted_at IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_comments_thread_active');
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_discussion_threads_class_active',
    );
    for (const table of ['comments', 'discussion_threads']) {
      await queryRunner.query(`
        ALTER TABLE ${table}
          DROP CONSTRAINT IF EXISTS ${table}_author_id_fkey,
          ALTER COLUMN author_id TYPE varchar USING author_id::text
      `);
    }
    await queryRunner.query(`
      ALTER TABLE merchant_profiles
        DROP CONSTRAINT IF EXISTS merchant_profiles_landing_background_asset_id_fkey,
        DROP COLUMN IF EXISTS landing_layout,
        DROP COLUMN IF EXISTS landing_background_asset_id
    `);
  }
}
