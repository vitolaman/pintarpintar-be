import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Users flagged `is_mentor` by the early seed have no `mentors` row, so every
 * mentor route answers 404 for them. Give each such user an active mentor
 * record without a profile, the state of a mentor hired through a job posting.
 * Users with any mentor row (active, inactive or soft-deleted) are left alone,
 * because that row records a decision. Safe to re-run.
 */
export class RepairFlaggedMentors1793700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO mentors (user_id)
      SELECT flagged.id
      FROM users flagged
      WHERE flagged.is_mentor
        AND flagged.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM mentors mentor WHERE mentor.user_id = flagged.id
        )
      ON CONFLICT (user_id) DO NOTHING
    `);
  }

  // The inserted rows cannot be told apart from rows the users complete later,
  // and removing them would bring the 404 back, so nothing is undone.
  public async down(): Promise<void> {}
}
