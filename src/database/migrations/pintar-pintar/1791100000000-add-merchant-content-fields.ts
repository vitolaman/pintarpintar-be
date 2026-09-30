import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DEFAULT_TUTOR_PERMISSIONS,
  TUTOR_ROLE_LABELS,
} from '../../../class/class-permissions';

const ASSET_REFERENCES: Array<[table: string, column: string]> = [
  ['classes', 'cover_asset_id'],
  ['file_resources', 'asset_id'],
  ['assignments', 'resource_asset_id'],
];

const CATEGORIES: Array<[name: string, slug: string]> = [
  ['Project Files', 'project-files'],
  ['Excel', 'excel'],
  ['Videografi', 'videografi'],
  ['Lainnya', 'lainnya'],
];

/**
 * Adds what the class and digital-product editors need: class covers and
 * post-purchase text, ordered videos and resources, private resource and
 * assignment files, validated tutor roles with permission matrices, and the
 * frontend's product categories. Safe to re-run.
 */
export class AddMerchantContentFields1791100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE classes
        ADD COLUMN IF NOT EXISTS cover_asset_id uuid,
        ADD COLUMN IF NOT EXISTS post_purchase_instructions text
    `);
    await queryRunner.query(`
      ALTER TABLE file_resources
        ADD COLUMN IF NOT EXISTS description text,
        ADD COLUMN IF NOT EXISTS asset_id uuid
    `);
    await queryRunner.query(
      'ALTER TABLE assignments ADD COLUMN IF NOT EXISTS resource_asset_id uuid',
    );
    await queryRunner.query(
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS post_purchase_instructions text',
    );
    for (const [table, column] of ASSET_REFERENCES) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${table}_${column}_fkey') THEN
            ALTER TABLE ${table} ADD CONSTRAINT ${table}_${column}_fkey
              FOREIGN KEY (${column}) REFERENCES file_assets(id) ON DELETE SET NULL;
          END IF;
        END $$
      `);
    }

    // Existing items keep their creation order within each chapter.
    for (const table of ['videos', 'file_resources']) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '${table}' AND column_name = 'order'
          ) THEN
            ALTER TABLE ${table} ADD COLUMN "order" integer NOT NULL DEFAULT 0;
            UPDATE ${table} item SET "order" = ranked.position - 1
            FROM (
              SELECT id, row_number() OVER (PARTITION BY chapter_id ORDER BY created_at, id) AS position
              FROM ${table}
            ) ranked
            WHERE ranked.id = item.id;
          END IF;
        END $$
      `);
    }

    for (const [label, code] of Object.entries(TUTOR_ROLE_LABELS)) {
      await queryRunner.query(
        'UPDATE class_mentors SET role = $2 WHERE role = $1',
        [label, code],
      );
    }
    await queryRunner.query(`
      DO $$
      DECLARE unknown text;
      BEGIN
        SELECT string_agg(DISTINCT role, ', ') INTO unknown FROM class_mentors
        WHERE role NOT IN ('lead', 'assistant', 'moderator');
        IF unknown IS NOT NULL THEN
          RAISE EXCEPTION 'class_mentors has unknown tutor roles: %', unknown;
        END IF;
      END $$
    `);
    for (const [role, permissions] of Object.entries(
      DEFAULT_TUTOR_PERMISSIONS,
    )) {
      await queryRunner.query(
        `UPDATE class_mentors SET permissions = $2::jsonb
         WHERE role = $1 AND (permissions IS NULL OR jsonb_typeof(permissions) <> 'object')`,
        [role, JSON.stringify(permissions)],
      );
    }
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_class_mentors_role') THEN
          ALTER TABLE class_mentors ADD CONSTRAINT chk_class_mentors_role
            CHECK (role IN ('lead', 'assistant', 'moderator'));
        END IF;
      END $$
    `);

    for (const [name, slug] of CATEGORIES) {
      await queryRunner.query(
        'INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING',
        [name, slug],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE class_mentors DROP CONSTRAINT IF EXISTS chk_class_mentors_role',
    );
    for (const [label, code] of Object.entries(TUTOR_ROLE_LABELS)) {
      await queryRunner.query(
        'UPDATE class_mentors SET role = $1 WHERE role = $2',
        [label, code],
      );
    }
    for (const [table, column] of ASSET_REFERENCES) {
      await queryRunner.query(
        `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_${column}_fkey`,
      );
    }
    await queryRunner.query(
      'ALTER TABLE products DROP COLUMN IF EXISTS post_purchase_instructions',
    );
    await queryRunner.query(
      'ALTER TABLE assignments DROP COLUMN IF EXISTS resource_asset_id',
    );
    await queryRunner.query(`
      ALTER TABLE file_resources
        DROP COLUMN IF EXISTS "order",
        DROP COLUMN IF EXISTS asset_id,
        DROP COLUMN IF EXISTS description
    `);
    await queryRunner.query('ALTER TABLE videos DROP COLUMN IF EXISTS "order"');
    await queryRunner.query(`
      ALTER TABLE classes
        DROP COLUMN IF EXISTS post_purchase_instructions,
        DROP COLUMN IF EXISTS cover_asset_id
    `);
  }
}
