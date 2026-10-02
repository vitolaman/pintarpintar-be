import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Class videos can be an uploaded file as well as a link. Existing videos
 * become link videos. The source check is NOT VALID so legacy rows (a link
 * video without a URL) do not block the migration; every new or updated row
 * is checked. Safe to re-run.
 */
export class AddVideoSources1792300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE videos
         ADD COLUMN IF NOT EXISTS source varchar(8) NOT NULL DEFAULT 'link',
         ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES file_assets(id) ON DELETE SET NULL`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_videos_source') THEN
          ALTER TABLE videos ADD CONSTRAINT chk_videos_source CHECK (
            (source = 'link' AND "youtubeUrl" IS NOT NULL AND asset_id IS NULL)
            OR (source = 'file' AND "youtubeUrl" IS NULL)
          ) NOT VALID;
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM videos WHERE source = 'file' AND deleted_at IS NULL) THEN
          RAISE EXCEPTION 'File videos exist; remove or convert them before reverting';
        END IF;
      END $$
    `);
    await queryRunner.query(
      'ALTER TABLE videos DROP CONSTRAINT IF EXISTS chk_videos_source',
    );
    await queryRunner.query(
      'ALTER TABLE videos DROP COLUMN IF EXISTS asset_id, DROP COLUMN IF EXISTS source',
    );
  }
}
