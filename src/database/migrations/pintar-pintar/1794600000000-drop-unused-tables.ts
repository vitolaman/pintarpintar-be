import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops tables that nothing uses (owner decision, 2026-10-14). They came from
 * the first schema built from the ERD and were replaced by the implemented
 * model: classes (with a type) for video classes and bootcamps, class_mentors,
 * discussion_threads and comments, meetings, merchant_daily_stats, and the
 * certificates tables. No code reads them and no other table references them.
 * A table that still has rows stops the migration, so no data is lost.
 * Safe to re-run.
 */
const UNUSED_TABLES = [
  'bootcamp_comments',
  'bootcamp_posts',
  'bootcamp_meetings',
  'bootcamp_admins',
  'bootcamps',
  'video_classes',
  'product_views',
  'issued_certificates',
  'course_certificate_configs',
];

export class DropUnusedTables1794600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of UNUSED_TABLES) {
      const [{ exists }] = await queryRunner.query(
        'SELECT to_regclass($1) IS NOT NULL AS exists',
        [table],
      );
      if (!exists) continue;
      const [{ rows }] = await queryRunner.query(
        `SELECT count(*)::integer AS rows FROM ${table}`,
      );
      if (rows > 0) {
        throw new Error(
          `Cannot drop ${table}: it has ${rows} rows. Check them before migrating.`,
        );
      }
    }
    // Children before parents, so no CASCADE is needed.
    for (const table of UNUSED_TABLES) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }

  // Recreates the tables empty, with the structure they had before the drop.
  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ exists }] = await queryRunner.query(
      "SELECT to_regclass('bootcamps') IS NOT NULL AS exists",
    );
    if (exists) return;
    await queryRunner.query(RECREATE_SQL);
  }
}

const RECREATE_SQL = `
CREATE TABLE bootcamp_admins (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    bootcamp_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);

CREATE TABLE bootcamp_comments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    deleted_by uuid,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE bootcamp_meetings (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    bootcamp_id uuid NOT NULL,
    title character varying NOT NULL,
    meeting_url character varying NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    duration_minutes integer NOT NULL,
    deleted_at timestamp without time zone,
    deleted_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

CREATE TABLE bootcamp_posts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    bootcamp_id uuid NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    attachment_url character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    deleted_at timestamp without time zone,
    deleted_by uuid
);

CREATE TABLE bootcamps (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    max_students integer NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);

CREATE TABLE course_certificate_configs (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    template_asset_id uuid,
    passing_completion_percentage numeric DEFAULT 100 NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT chk_certificate_config_completion CHECK (((passing_completion_percentage >= (0)::numeric) AND (passing_completion_percentage <= (100)::numeric)))
);

CREATE TABLE issued_certificates (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    access_id uuid NOT NULL,
    certificate_number character varying NOT NULL,
    certificate_asset_id uuid,
    issued_at timestamp without time zone DEFAULT now() NOT NULL,
    revoked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);

CREATE TABLE product_views (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    view_date date NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);

CREATE TABLE video_classes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    total_duration integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);

ALTER TABLE ONLY bootcamp_admins
    ADD CONSTRAINT bootcamp_admins_pkey PRIMARY KEY (id);

ALTER TABLE ONLY bootcamp_comments
    ADD CONSTRAINT bootcamp_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY bootcamp_meetings
    ADD CONSTRAINT bootcamp_meetings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY bootcamp_posts
    ADD CONSTRAINT bootcamp_posts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY bootcamps
    ADD CONSTRAINT bootcamps_pkey PRIMARY KEY (id);

ALTER TABLE ONLY bootcamps
    ADD CONSTRAINT bootcamps_product_id_key UNIQUE (product_id);

ALTER TABLE ONLY course_certificate_configs
    ADD CONSTRAINT course_certificate_configs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY course_certificate_configs
    ADD CONSTRAINT course_certificate_configs_product_id_key UNIQUE (product_id);

ALTER TABLE ONLY issued_certificates
    ADD CONSTRAINT issued_certificates_access_id_key UNIQUE (access_id);

ALTER TABLE ONLY issued_certificates
    ADD CONSTRAINT issued_certificates_certificate_number_key UNIQUE (certificate_number);

ALTER TABLE ONLY issued_certificates
    ADD CONSTRAINT issued_certificates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY product_views
    ADD CONSTRAINT product_views_pkey PRIMARY KEY (id);

ALTER TABLE ONLY bootcamp_admins
    ADD CONSTRAINT uq_bootcamp_admins_user UNIQUE (bootcamp_id, user_id);

ALTER TABLE ONLY product_views
    ADD CONSTRAINT uq_product_views_daily UNIQUE (product_id, view_date);

ALTER TABLE ONLY video_classes
    ADD CONSTRAINT video_classes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY video_classes
    ADD CONSTRAINT video_classes_product_id_key UNIQUE (product_id);

ALTER TABLE ONLY bootcamp_admins
    ADD CONSTRAINT bootcamp_admins_bootcamp_id_fkey FOREIGN KEY (bootcamp_id) REFERENCES bootcamps(id) ON DELETE CASCADE;

ALTER TABLE ONLY bootcamp_admins
    ADD CONSTRAINT bootcamp_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ONLY bootcamp_comments
    ADD CONSTRAINT bootcamp_comments_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY bootcamp_comments
    ADD CONSTRAINT bootcamp_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES bootcamp_posts(id) ON DELETE CASCADE;

ALTER TABLE ONLY bootcamp_comments
    ADD CONSTRAINT bootcamp_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ONLY bootcamp_meetings
    ADD CONSTRAINT bootcamp_meetings_bootcamp_id_fkey FOREIGN KEY (bootcamp_id) REFERENCES bootcamps(id) ON DELETE CASCADE;

ALTER TABLE ONLY bootcamp_meetings
    ADD CONSTRAINT bootcamp_meetings_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY bootcamp_posts
    ADD CONSTRAINT bootcamp_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id);

ALTER TABLE ONLY bootcamp_posts
    ADD CONSTRAINT bootcamp_posts_bootcamp_id_fkey FOREIGN KEY (bootcamp_id) REFERENCES bootcamps(id) ON DELETE CASCADE;

ALTER TABLE ONLY bootcamp_posts
    ADD CONSTRAINT bootcamp_posts_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY bootcamp_posts
    ADD CONSTRAINT bootcamp_posts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY bootcamps
    ADD CONSTRAINT bootcamps_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE ONLY bootcamps
    ADD CONSTRAINT bootcamps_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ONLY course_certificate_configs
    ADD CONSTRAINT course_certificate_configs_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE ONLY course_certificate_configs
    ADD CONSTRAINT course_certificate_configs_template_asset_id_fkey FOREIGN KEY (template_asset_id) REFERENCES file_assets(id) ON DELETE SET NULL;

ALTER TABLE ONLY issued_certificates
    ADD CONSTRAINT issued_certificates_access_id_fkey FOREIGN KEY (access_id) REFERENCES user_access(id);

ALTER TABLE ONLY issued_certificates
    ADD CONSTRAINT issued_certificates_certificate_asset_id_fkey FOREIGN KEY (certificate_asset_id) REFERENCES file_assets(id) ON DELETE SET NULL;

ALTER TABLE ONLY issued_certificates
    ADD CONSTRAINT issued_certificates_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);

ALTER TABLE ONLY issued_certificates
    ADD CONSTRAINT issued_certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE ONLY product_views
    ADD CONSTRAINT product_views_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);

ALTER TABLE ONLY video_classes
    ADD CONSTRAINT video_classes_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
`;
