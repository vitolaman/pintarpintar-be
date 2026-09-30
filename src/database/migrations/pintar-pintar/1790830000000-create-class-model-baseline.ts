import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reproduces the class-model tables that shared development received only
 * through runtime synchronization, using the shared schema captured on
 * 2026-09-30. Existing tables and rows are never altered.
 */
export class CreateClassModelBaseline1790830000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `CREATE TABLE IF NOT EXISTS classes (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "merchant_id" uuid NOT NULL REFERENCES merchants(id),
        "title" character varying NOT NULL,
        "description" text,
        "status" character varying NOT NULL DEFAULT 'draft'::character varying,
        "type" character varying NOT NULL DEFAULT 'video'::character varying,
        "originalPrice" double precision,
        "discountedPrice" double precision
      )`,
      `CREATE TABLE IF NOT EXISTS chapters (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "class_id" uuid NOT NULL REFERENCES classes(id),
        "title" character varying NOT NULL,
        "description" text,
        "order" integer NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS meetings (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "class_id" uuid NOT NULL REFERENCES classes(id),
        "title" character varying NOT NULL,
        "content" text,
        "date" date,
        "time" time without time zone,
        "liveUrl" character varying,
        "status" character varying NOT NULL DEFAULT 'upcoming'::character varying
      )`,
      `CREATE TABLE IF NOT EXISTS assignments (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "class_id" uuid NOT NULL REFERENCES classes(id),
        "title" character varying NOT NULL,
        "description" text,
        "due" timestamp without time zone,
        "type" character varying NOT NULL DEFAULT 'file_upload'::character varying
      )`,
      `CREATE TABLE IF NOT EXISTS assignment_questions (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "assignment_id" uuid NOT NULL REFERENCES assignments(id),
        "question_text" text NOT NULL,
        "type" character varying NOT NULL DEFAULT 'essay'::character varying,
        "options" jsonb,
        "correct_answer" character varying,
        "score_weight" integer NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS enrollments (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "user_id" uuid NOT NULL REFERENCES users(id),
        "class_id" uuid NOT NULL REFERENCES classes(id),
        "joinDate" date,
        "progress" character varying
      )`,
      `CREATE TABLE IF NOT EXISTS certificates (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "class_id" uuid NOT NULL REFERENCES classes(id),
        "user_id" uuid NOT NULL REFERENCES users(id),
        "certNo" character varying,
        "status" character varying NOT NULL DEFAULT 'pending'::character varying,
        "issueDate" date,
        "fileUrl" character varying
      )`,
      `CREATE TABLE IF NOT EXISTS class_mentors (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "class_id" uuid NOT NULL REFERENCES classes(id),
        "mentor_id" uuid NOT NULL REFERENCES mentors(id),
        "role" character varying NOT NULL,
        "permissions" jsonb
      )`,
      `CREATE TABLE IF NOT EXISTS discussion_threads (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "class_id" uuid NOT NULL REFERENCES classes(id),
        "author_id" character varying NOT NULL,
        "author_role" character varying,
        "title" character varying NOT NULL,
        "content" text NOT NULL,
        "badge" character varying NOT NULL DEFAULT 'Tanya Jawab'::character varying,
        "date" timestamp without time zone NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS comments (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "thread_id" uuid NOT NULL REFERENCES discussion_threads(id),
        "author_id" character varying NOT NULL,
        "author_role" character varying,
        "content" text NOT NULL,
        "timestamp" timestamp without time zone NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS file_resources (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "chapter_id" uuid NOT NULL REFERENCES chapters(id),
        "name" character varying NOT NULL,
        "type" character varying NOT NULL DEFAULT 'pdf'::character varying,
        "url" character varying,
        "size" character varying
      )`,
      `CREATE TABLE IF NOT EXISTS attendances (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "meeting_id" uuid NOT NULL REFERENCES meetings(id),
        "user_id" uuid NOT NULL REFERENCES users(id),
        "status" character varying NOT NULL DEFAULT 'hadir'::character varying,
        "checkInTime" time without time zone,
        "notes" text
      )`,
      `CREATE TABLE IF NOT EXISTS submissions (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "assignment_id" uuid NOT NULL REFERENCES assignments(id),
        "user_id" uuid NOT NULL REFERENCES users(id),
        "fileName" character varying,
        "fileUrl" character varying,
        "submissionDate" timestamp without time zone NOT NULL DEFAULT now(),
        "total_score" integer
      )`,
      `CREATE TABLE IF NOT EXISTS submission_answers (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "deleted_at" timestamp without time zone,
        "created_by" character varying,
        "updated_by" character varying,
        "deleted_by" character varying,
        "submission_id" uuid NOT NULL REFERENCES submissions(id),
        "question_id" uuid NOT NULL REFERENCES assignment_questions(id),
        "user_answer" text,
        "is_correct" boolean,
        "score_awarded" integer
      )`,
    ];

    for (const statement of statements) {
      await queryRunner.query(statement);
    }

    await this.reshapeErdVideos(queryRunner);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS videos (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" character varying NOT NULL,
        "deleted_at" timestamp without time zone,
        "created_at" timestamp without time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
        "created_by" character varying,
        "updated_by" character varying,
        "chapter_id" uuid NOT NULL REFERENCES chapters(id),
        "description" text,
        "youtubeUrl" character varying,
        "duration" character varying,
        "deleted_by" character varying
      )`);
  }

  public async down(): Promise<void> {
    // Intentionally non-destructive: these tables may hold teammate data that
    // existed before this migration was recorded.
  }

  /**
   * A migration-built database still has the empty ERD-shaped `videos` table.
   * Convert it to the class-module shape, refusing to discard existing rows.
   */
  private async reshapeErdVideos(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'video_class_id'
        ) THEN
          IF EXISTS (SELECT 1 FROM videos) THEN
            RAISE EXCEPTION 'videos still has ERD-shaped rows; migrate them to chapters before reshaping';
          END IF;

          ALTER TABLE videos DROP CONSTRAINT IF EXISTS uq_videos_class_order;
          ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_video_class_id_fkey;
          ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_deleted_by_fkey;
          ALTER TABLE videos DROP COLUMN video_class_id;
          ALTER TABLE videos DROP COLUMN video_url;
          ALTER TABLE videos DROP COLUMN order_index;
          ALTER TABLE videos DROP COLUMN duration_seconds;
          ALTER TABLE videos ALTER COLUMN deleted_by TYPE character varying;
          ALTER TABLE videos ADD COLUMN created_by character varying;
          ALTER TABLE videos ADD COLUMN updated_by character varying;
          ALTER TABLE videos ADD COLUMN chapter_id uuid NOT NULL REFERENCES chapters(id);
          ALTER TABLE videos ADD COLUMN description text;
          ALTER TABLE videos ADD COLUMN "youtubeUrl" character varying;
          ALTER TABLE videos ADD COLUMN duration character varying;
        END IF;
      END $$
    `);
  }
}
