import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The LinkedIn URL of a job application becomes optional (frontend request,
 * 2026-10-10). Safe to re-run.
 */
export class MakeApplicationLinkedinOptional1794100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE job_applications ALTER COLUMN linkedin_url DROP NOT NULL',
    );
  }

  // Applications without a LinkedIn URL keep an empty one.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE job_applications SET linkedin_url = '' WHERE linkedin_url IS NULL",
    );
    await queryRunner.query(
      'ALTER TABLE job_applications ALTER COLUMN linkedin_url SET NOT NULL',
    );
  }
}
