import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the optional duration and mentor of live bootcamp meetings shown on
 * the bootcamp schedule. Safe to re-run.
 */
export class AddBootcampMeetingDetails1791600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE meetings
        ADD COLUMN IF NOT EXISTS duration_minutes integer,
        ADD COLUMN IF NOT EXISTS mentor_id uuid
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_meetings_duration_minutes') THEN
          ALTER TABLE meetings ADD CONSTRAINT chk_meetings_duration_minutes
            CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meetings_mentor_id_fkey') THEN
          ALTER TABLE meetings ADD CONSTRAINT meetings_mentor_id_fkey
            FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE SET NULL;
        END IF;
      END $$
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_meetings_mentor ON meetings (mentor_id) WHERE mentor_id IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_meetings_mentor');
    await queryRunner.query(
      'ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_mentor_id_fkey',
    );
    await queryRunner.query(
      'ALTER TABLE meetings DROP CONSTRAINT IF EXISTS chk_meetings_duration_minutes',
    );
    await queryRunner.query(`
      ALTER TABLE meetings
        DROP COLUMN IF EXISTS mentor_id,
        DROP COLUMN IF EXISTS duration_minutes
    `);
  }
}
