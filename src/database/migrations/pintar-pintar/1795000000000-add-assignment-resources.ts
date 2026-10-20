import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ordered resource files (up to 10) for assignments. Each assignment's
 * existing resource becomes its first file; assignments keep
 * resource_asset_id as that first file. Safe to re-run.
 */
export class AddAssignmentResources1795000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assignment_resources (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        asset_id uuid NOT NULL REFERENCES file_assets(id) ON DELETE CASCADE,
        position smallint NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_assignment_resources_position CHECK (position BETWEEN 0 AND 9)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_assignment_resources_position
       ON assignment_resources (assignment_id, position) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_assignment_resources_asset
       ON assignment_resources (assignment_id, asset_id) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(`
      INSERT INTO assignment_resources (assignment_id, asset_id, position)
      SELECT assignment.id, assignment.resource_asset_id, 0
      FROM assignments assignment
      INNER JOIN file_assets asset
        ON asset.id = assignment.resource_asset_id AND asset.deleted_at IS NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM assignment_resources resource
        WHERE resource.assignment_id = assignment.id AND resource.deleted_at IS NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS assignment_resources');
  }
}
