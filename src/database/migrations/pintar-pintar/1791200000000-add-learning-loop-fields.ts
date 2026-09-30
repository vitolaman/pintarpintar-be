import { MigrationInterface, QueryRunner } from 'typeorm';

// One row per learner where the learning loop relies on it. Each index is
// created only after checking that existing rows would not violate it.
const UNIQUE_INDEXES: Array<{
  name: string;
  table: string;
  columns: string;
  where: string;
}> = [
  {
    name: 'uq_submissions_assignment_user',
    table: 'submissions',
    columns: 'assignment_id, user_id',
    where: 'deleted_at IS NULL',
  },
  {
    name: 'uq_attendances_meeting_user',
    table: 'attendances',
    columns: 'meeting_id, user_id',
    where: 'deleted_at IS NULL',
  },
  {
    name: 'uq_certificates_class_user',
    table: 'certificates',
    columns: 'class_id, user_id',
    where: 'deleted_at IS NULL',
  },
  // Withdrawn certificates keep their number, so numbers are never reused.
  {
    name: 'uq_certificates_number',
    table: 'certificates',
    columns: '"certNo"',
    where: '"certNo" IS NOT NULL',
  },
  {
    name: 'uq_reviews_user_product',
    table: 'reviews',
    columns: 'user_id, product_id',
    where: 'product_id IS NOT NULL AND deleted_at IS NULL',
  },
  {
    name: 'uq_enrollments_user_class',
    table: 'enrollments',
    columns: 'user_id, class_id',
    where: 'deleted_at IS NULL',
  },
];

const FOREIGN_KEYS: Array<[table: string, column: string, target: string]> = [
  ['submissions', 'file_asset_id', 'file_assets'],
  ['submissions', 'graded_by', 'users'],
  ['certificates', 'asset_id', 'file_assets'],
];

/**
 * Adds what learners, graders and certificates need: per-video completion,
 * class certificate settings, private submission and certificate files,
 * grading details, and one-row-per-learner guarantees. Safe to re-run.
 */
export class AddLearningLoopFields1791200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS video_completions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        completed_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT uq_video_completions_user_video UNIQUE (user_id, video_id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_video_completions_class_user ON video_completions (class_id, user_id)',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS class_certificate_settings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        auto_issue boolean NOT NULL DEFAULT false,
        min_attendance_percent integer NOT NULL DEFAULT 80,
        min_score integer NOT NULL DEFAULT 75,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT uq_class_certificate_settings_class UNIQUE (class_id),
        CONSTRAINT chk_class_certificate_settings_attendance
          CHECK (min_attendance_percent BETWEEN 0 AND 100),
        CONSTRAINT chk_class_certificate_settings_score
          CHECK (min_score BETWEEN 0 AND 100)
      )
    `);

    await queryRunner.query(`
      ALTER TABLE submissions
        ADD COLUMN IF NOT EXISTS file_asset_id uuid,
        ADD COLUMN IF NOT EXISTS feedback text,
        ADD COLUMN IF NOT EXISTS is_late boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS graded_at timestamp,
        ADD COLUMN IF NOT EXISTS graded_by uuid
    `);
    await queryRunner.query(
      'ALTER TABLE certificates ADD COLUMN IF NOT EXISTS asset_id uuid',
    );
    for (const [table, column, target] of FOREIGN_KEYS) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${table}_${column}_fkey') THEN
            ALTER TABLE ${table} ADD CONSTRAINT ${table}_${column}_fkey
              FOREIGN KEY (${column}) REFERENCES ${target}(id) ON DELETE SET NULL;
          END IF;
        END $$
      `);
    }

    for (const index of UNIQUE_INDEXES) {
      const [{ duplicates }] = await queryRunner.query(`
        SELECT count(*)::integer AS duplicates FROM (
          SELECT 1 FROM ${index.table}
          WHERE ${index.where}
          GROUP BY ${index.columns}
          HAVING count(*) > 1
        ) repeated
      `);
      if (duplicates > 0) {
        throw new Error(
          `Cannot create ${index.name}: ${duplicates} duplicate (${index.columns}) groups in ${index.table}. Resolve them before migrating.`,
        );
      }
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${index.name} ON ${index.table} (${index.columns}) WHERE ${index.where}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const index of [...UNIQUE_INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX IF EXISTS ${index.name}`);
    }
    for (const [table, column] of [...FOREIGN_KEYS].reverse()) {
      await queryRunner.query(
        `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_${column}_fkey`,
      );
    }
    await queryRunner.query(
      'ALTER TABLE certificates DROP COLUMN IF EXISTS asset_id',
    );
    await queryRunner.query(`
      ALTER TABLE submissions
        DROP COLUMN IF EXISTS graded_by,
        DROP COLUMN IF EXISTS graded_at,
        DROP COLUMN IF EXISTS is_late,
        DROP COLUMN IF EXISTS feedback,
        DROP COLUMN IF EXISTS file_asset_id
    `);
    await queryRunner.query('DROP TABLE IF EXISTS class_certificate_settings');
    await queryRunner.query('DROP TABLE IF EXISTS video_completions');
  }
}
