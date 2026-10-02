import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Job postings a user saved on the job board ("Lowongan Tersimpan"). One row
 * per user and posting; unsaving deletes the row. Safe to re-run.
 */
export class AddSavedJobPostings1792400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS saved_job_postings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        job_posting_id uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_job_postings_user_job
       ON saved_job_postings (user_id, job_posting_id) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_saved_job_postings_user_created
       ON saved_job_postings (user_id, created_at DESC) WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS saved_job_postings');
  }
}
