import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlatformSchemaFoundation1788739200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN is_mentor boolean NOT NULL DEFAULT false,
      ADD COLUMN is_merchant boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE file_assets (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        uploaded_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        storage_provider varchar NOT NULL,
        object_key varchar NOT NULL,
        original_filename varchar NOT NULL,
        mime_type varchar NOT NULL,
        size_bytes bigint NOT NULL,
        checksum_sha256 varchar,
        visibility varchar NOT NULL DEFAULT 'private',
        status varchar NOT NULL DEFAULT 'active',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT uq_file_assets_storage_object UNIQUE (storage_provider, object_key)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE user_profiles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        avatar_asset_id uuid REFERENCES file_assets(id) ON DELETE SET NULL,
        phone varchar,
        headline varchar,
        bio text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);

    await queryRunner.query(`
      CREATE TABLE user_notification_preferences (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        email_new_sale boolean NOT NULL DEFAULT true,
        email_new_applicant boolean NOT NULL DEFAULT true,
        email_new_review boolean NOT NULL DEFAULT true,
        email_weekly_report boolean NOT NULL DEFAULT true,
        whatsapp_new_order boolean NOT NULL DEFAULT true,
        whatsapp_payout_approved boolean NOT NULL DEFAULT true,
        whatsapp_student_chat boolean NOT NULL DEFAULT false,
        promotion_broadcast boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);

    await queryRunner.query(`
      CREATE TABLE merchant_profiles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE CASCADE,
        slug varchar NOT NULL UNIQUE,
        avatar_asset_id uuid REFERENCES file_assets(id) ON DELETE SET NULL,
        cover_asset_id uuid REFERENCES file_assets(id) ON DELETE SET NULL,
        tagline varchar,
        category_label varchar,
        city varchar,
        public_email varchar,
        public_phone varchar,
        website_url varchar,
        instagram_handle varchar,
        youtube_url varchar,
        linkedin_url varchar,
        expertise varchar,
        experience_years integer,
        education varchar,
        portfolio_url varchar,
        cv_asset_id uuid REFERENCES file_assets(id) ON DELETE SET NULL,
        certificate_asset_id uuid REFERENCES file_assets(id) ON DELETE SET NULL,
        terms_accepted_at timestamp,
        refund_policy text,
        digital_license text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_merchant_profiles_experience_years
          CHECK (experience_years IS NULL OR experience_years >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE merchant_skills (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        name varchar NOT NULL,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT uq_merchant_skills_name UNIQUE (merchant_id, name)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE merchant_members (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role varchar NOT NULL,
        status varchar NOT NULL DEFAULT 'active',
        invited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        joined_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT uq_merchant_members_user UNIQUE (merchant_id, user_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE merchant_mentors (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        mentor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status varchar NOT NULL DEFAULT 'active',
        joined_at timestamp,
        ended_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT uq_merchant_mentors_user UNIQUE (merchant_id, mentor_user_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE product_mentors (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        mentor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role varchar NOT NULL DEFAULT 'instructor',
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT uq_product_mentors_user UNIQUE (product_id, mentor_user_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE merchant_payout_accounts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        bank_name varchar NOT NULL,
        account_holder_name varchar NOT NULL,
        encrypted_account_number text NOT NULL,
        masked_account_number varchar NOT NULL,
        verification_status varchar NOT NULL DEFAULT 'unverified',
        is_primary boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_merchant_payout_accounts_primary
      ON merchant_payout_accounts (merchant_id)
      WHERE is_primary AND deleted_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE user_memberships (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_code varchar NOT NULL,
        status varchar NOT NULL,
        started_at timestamp NOT NULL DEFAULT now(),
        expires_at timestamp,
        source_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);

    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN publication_status varchar NOT NULL DEFAULT 'unpublished',
      ADD COLUMN cover_asset_id uuid REFERENCES file_assets(id) ON DELETE SET NULL,
      ADD COLUMN level varchar,
      ADD COLUMN original_price numeric,
      ADD COLUMN customer_email_instructions text,
      ADD COLUMN published_at timestamp,
      ADD CONSTRAINT chk_products_publication_status
        CHECK (publication_status IN ('published', 'unlisted', 'unpublished')),
      ADD CONSTRAINT chk_products_original_price
        CHECK (original_price IS NULL OR original_price >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE digital_files
      ADD COLUMN asset_id uuid REFERENCES file_assets(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE course_certificate_configs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id uuid NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
        template_asset_id uuid REFERENCES file_assets(id) ON DELETE SET NULL,
        passing_completion_percentage numeric NOT NULL DEFAULT 100,
        is_enabled boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_certificate_config_completion
          CHECK (passing_completion_percentage BETWEEN 0 AND 100)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE issued_certificates (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users(id),
        product_id uuid NOT NULL REFERENCES products(id),
        access_id uuid NOT NULL UNIQUE REFERENCES user_access(id),
        certificate_number varchar NOT NULL UNIQUE,
        certificate_asset_id uuid REFERENCES file_assets(id) ON DELETE SET NULL,
        issued_at timestamp NOT NULL DEFAULT now(),
        revoked_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);

    await queryRunner.query(
      'ALTER TABLE categories ADD CONSTRAINT uq_categories_slug UNIQUE (slug)',
    );
    await queryRunner.query(
      'ALTER TABLE product_categories ADD CONSTRAINT uq_product_categories_pair UNIQUE (product_id, category_id)',
    );
    await queryRunner.query(
      'ALTER TABLE videos ADD CONSTRAINT uq_videos_class_order UNIQUE (video_class_id, order_index)',
    );
    await queryRunner.query(
      'ALTER TABLE bootcamp_admins ADD CONSTRAINT uq_bootcamp_admins_user UNIQUE (bootcamp_id, user_id)',
    );
    await queryRunner.query(
      'ALTER TABLE wishlist ADD CONSTRAINT uq_wishlist_user_product UNIQUE (user_id, product_id)',
    );
    await queryRunner.query(
      'ALTER TABLE user_access ADD CONSTRAINT uq_user_access_user_product UNIQUE (user_id, product_id)',
    );
    await queryRunner.query(
      'ALTER TABLE student_progress ADD CONSTRAINT uq_student_progress_access UNIQUE (access_id)',
    );
    await queryRunner.query(
      'ALTER TABLE product_views ADD CONSTRAINT uq_product_views_daily UNIQUE (product_id, view_date)',
    );
    await queryRunner.query(
      'ALTER TABLE merchant_daily_stats ADD CONSTRAINT uq_merchant_daily_stats_daily UNIQUE (merchant_id, stat_date)',
    );
    await queryRunner.query(
      'ALTER TABLE payout_items ADD CONSTRAINT uq_payout_items_order_item UNIQUE (order_item_id)',
    );
    await queryRunner.query(
      'ALTER TABLE reviews ADD CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)',
    );

    await queryRunner.query(
      'CREATE INDEX idx_products_public_discovery ON products (publication_status, product_type, published_at DESC, created_at DESC) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX idx_products_merchant_discovery ON products (merchant_id, publication_status, created_at DESC) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX idx_product_categories_category_product ON product_categories (category_id, product_id) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX idx_reviews_product_active ON reviews (product_id) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX idx_user_access_user_expiry ON user_access (user_id, expires_at) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX idx_notifications_user_unread_created ON notifications (user_id, is_read, created_at DESC) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX idx_product_mentors_mentor_product ON product_mentors (mentor_user_id, product_id) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX idx_merchant_members_user ON merchant_members (user_id) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX idx_merchant_mentors_user ON merchant_mentors (mentor_user_id) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX idx_user_memberships_user_expiry ON user_memberships (user_id, expires_at) WHERE deleted_at IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_user_memberships_user_expiry');
    await queryRunner.query('DROP INDEX idx_merchant_mentors_user');
    await queryRunner.query('DROP INDEX idx_merchant_members_user');
    await queryRunner.query('DROP INDEX idx_product_mentors_mentor_product');
    await queryRunner.query('DROP INDEX idx_notifications_user_unread_created');
    await queryRunner.query('DROP INDEX idx_user_access_user_expiry');
    await queryRunner.query('DROP INDEX idx_reviews_product_active');
    await queryRunner.query(
      'DROP INDEX idx_product_categories_category_product',
    );
    await queryRunner.query('DROP INDEX idx_products_merchant_discovery');
    await queryRunner.query('DROP INDEX idx_products_public_discovery');

    await queryRunner.query(
      'ALTER TABLE reviews DROP CONSTRAINT chk_reviews_rating',
    );
    await queryRunner.query(
      'ALTER TABLE payout_items DROP CONSTRAINT uq_payout_items_order_item',
    );
    await queryRunner.query(
      'ALTER TABLE merchant_daily_stats DROP CONSTRAINT uq_merchant_daily_stats_daily',
    );
    await queryRunner.query(
      'ALTER TABLE product_views DROP CONSTRAINT uq_product_views_daily',
    );
    await queryRunner.query(
      'ALTER TABLE student_progress DROP CONSTRAINT uq_student_progress_access',
    );
    await queryRunner.query(
      'ALTER TABLE user_access DROP CONSTRAINT uq_user_access_user_product',
    );
    await queryRunner.query(
      'ALTER TABLE wishlist DROP CONSTRAINT uq_wishlist_user_product',
    );
    await queryRunner.query(
      'ALTER TABLE bootcamp_admins DROP CONSTRAINT uq_bootcamp_admins_user',
    );
    await queryRunner.query(
      'ALTER TABLE videos DROP CONSTRAINT uq_videos_class_order',
    );
    await queryRunner.query(
      'ALTER TABLE product_categories DROP CONSTRAINT uq_product_categories_pair',
    );
    await queryRunner.query(
      'ALTER TABLE categories DROP CONSTRAINT uq_categories_slug',
    );

    await queryRunner.query('DROP TABLE issued_certificates');
    await queryRunner.query('DROP TABLE course_certificate_configs');
    await queryRunner.query('ALTER TABLE digital_files DROP COLUMN asset_id');
    await queryRunner.query(
      'ALTER TABLE products DROP CONSTRAINT chk_products_original_price, DROP CONSTRAINT chk_products_publication_status, DROP COLUMN published_at, DROP COLUMN customer_email_instructions, DROP COLUMN original_price, DROP COLUMN level, DROP COLUMN cover_asset_id, DROP COLUMN publication_status',
    );
    await queryRunner.query('DROP TABLE user_memberships');
    await queryRunner.query('DROP INDEX uq_merchant_payout_accounts_primary');
    await queryRunner.query('DROP TABLE merchant_payout_accounts');
    await queryRunner.query('DROP TABLE product_mentors');
    await queryRunner.query('DROP TABLE merchant_mentors');
    await queryRunner.query('DROP TABLE merchant_members');
    await queryRunner.query('DROP TABLE merchant_skills');
    await queryRunner.query('DROP TABLE merchant_profiles');
    await queryRunner.query('DROP TABLE user_notification_preferences');
    await queryRunner.query('DROP TABLE user_profiles');
    await queryRunner.query('DROP TABLE file_assets');
    await queryRunner.query(
      'ALTER TABLE users DROP COLUMN is_merchant, DROP COLUMN is_mentor',
    );
  }
}
