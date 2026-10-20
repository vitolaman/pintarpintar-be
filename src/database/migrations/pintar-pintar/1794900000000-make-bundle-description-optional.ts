import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The description of a bundle becomes optional (the frontend form labels it
 * optional; owner decision, 2026-10-20). Safe to re-run.
 */
export class MakeBundleDescriptionOptional1794900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE bundles ALTER COLUMN description DROP NOT NULL',
    );
  }

  // Bundles without a description keep an empty one.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE bundles SET description = '' WHERE description IS NULL",
    );
    await queryRunner.query(
      'ALTER TABLE bundles ALTER COLUMN description SET NOT NULL',
    );
  }
}
