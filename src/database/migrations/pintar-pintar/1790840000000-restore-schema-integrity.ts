import { MigrationInterface, QueryRunner } from 'typeorm';

type ConstraintDefinition = [table: string, name: string, definition: string];

const UUID_PATTERN =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

// Identifier columns that runtime synchronization retyped to varchar.
const RETYPED_IDENTIFIERS: [table: string, column: string][] = [
  ['user_access', 'user_id'],
  ['user_access', 'product_id'],
  ['products', 'merchant_id'],
  ['issued_certificates', 'user_id'],
  ['issued_certificates', 'product_id'],
  ['issued_certificates', 'access_id'],
  ['student_progress', 'access_id'],
];

const RESTORED_DEFAULTS: [table: string, column: string, value: string][] = [
  ['coupons', 'is_active', 'true'],
  ['merchants', 'balance', '0'],
  ['merchants', 'lifetime_earnings', '0'],
  ['file_assets', 'status', "'active'"],
  ['file_assets', 'visibility', "'private'"],
  ['issued_certificates', 'issued_at', 'now()'],
  ['mentors', 'status', "'active'"],
  ['merchant_members', 'status', "'active'"],
  ['products', 'is_published', 'false'],
  ['products', 'publication_status', "'unpublished'"],
  ['student_progress', 'completion_percentage', '0'],
  ['student_progress', 'total_time_spent', '0'],
  ['user_access', 'granted_at', 'now()'],
];

// Migration-defined constraints, in dependency order (checks, unique keys,
// then foreign keys). Definitions use PostgreSQL's canonical form where it
// round-trips, so an equivalent constraint under another name is recognised;
// the two IN checks keep their original wording and are matched by name.
const RESTORED_CONSTRAINTS: ConstraintDefinition[] = [
  [
    'merchant_profiles',
    'chk_merchant_profiles_experience_years',
    'CHECK (((experience_years IS NULL) OR (experience_years >= 0)))',
  ],
  [
    'mentor_profiles',
    'chk_mentor_profiles_experience_years',
    'CHECK ((experience_years >= 0))',
  ],
  [
    'coupons',
    'chk_coupons_discount_type',
    "CHECK (discount_type IN ('percentage', 'nominal'))",
  ],
  [
    'coupons',
    'chk_coupons_discount_value',
    'CHECK ((discount_value > (0)::numeric))',
  ],
  [
    'coupons',
    'chk_coupons_max_uses',
    'CHECK (((max_uses IS NULL) OR (max_uses > 0)))',
  ],
  [
    'coupons',
    'chk_coupons_maximum_discount_amount',
    'CHECK (((maximum_discount_amount IS NULL) OR (maximum_discount_amount >= (0)::numeric)))',
  ],
  [
    'coupons',
    'chk_coupons_minimum_order_amount',
    'CHECK (((minimum_order_amount IS NULL) OR (minimum_order_amount >= (0)::numeric)))',
  ],
  [
    'coupons',
    'chk_coupons_percentage_value',
    "CHECK ((((discount_type)::text <> 'percentage'::text) OR (discount_value <= (100)::numeric)))",
  ],
  [
    'coupons',
    'chk_coupons_period',
    'CHECK (((starts_at IS NULL) OR (expires_at IS NULL) OR (starts_at < expires_at)))',
  ],
  [
    'products',
    'chk_products_original_price',
    'CHECK (((original_price IS NULL) OR (original_price >= (0)::numeric)))',
  ],
  [
    'products',
    'chk_products_publication_status',
    "CHECK (publication_status IN ('published', 'unlisted', 'unpublished'))",
  ],
  [
    'file_assets',
    'uq_file_assets_storage_object',
    'UNIQUE (storage_provider, object_key)',
  ],
  ['merchants', 'merchants_user_id_key', 'UNIQUE (user_id)'],
  [
    'merchant_profiles',
    'merchant_profiles_merchant_id_key',
    'UNIQUE (merchant_id)',
  ],
  ['merchant_profiles', 'merchant_profiles_slug_key', 'UNIQUE (slug)'],
  [
    'merchant_members',
    'uq_merchant_members_user',
    'UNIQUE (merchant_id, user_id)',
  ],
  ['mentors', 'mentors_user_id_key', 'UNIQUE (user_id)'],
  ['mentor_profiles', 'mentor_profiles_mentor_id_key', 'UNIQUE (mentor_id)'],
  ['user_profiles', 'user_profiles_user_id_key', 'UNIQUE (user_id)'],
  [
    'user_notification_preferences',
    'user_notification_preferences_user_id_key',
    'UNIQUE (user_id)',
  ],
  [
    'user_access',
    'uq_user_access_user_product',
    'UNIQUE (user_id, product_id)',
  ],
  [
    'issued_certificates',
    'issued_certificates_access_id_key',
    'UNIQUE (access_id)',
  ],
  [
    'issued_certificates',
    'issued_certificates_certificate_number_key',
    'UNIQUE (certificate_number)',
  ],
  ['student_progress', 'uq_student_progress_access', 'UNIQUE (access_id)'],
  [
    'users',
    'fk_users_deleted_by',
    'FOREIGN KEY (deleted_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL',
  ],
  [
    'file_assets',
    'file_assets_uploaded_by_user_id_fkey',
    'FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL',
  ],
  [
    'merchants',
    'merchants_deleted_by_fkey',
    'FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL',
  ],
  [
    'merchants',
    'merchants_user_id_fkey',
    'FOREIGN KEY (user_id) REFERENCES users(id)',
  ],
  [
    'merchant_profiles',
    'merchant_profiles_avatar_asset_id_fkey',
    'FOREIGN KEY (avatar_asset_id) REFERENCES file_assets(id) ON DELETE SET NULL',
  ],
  [
    'merchant_profiles',
    'merchant_profiles_certificate_asset_id_fkey',
    'FOREIGN KEY (certificate_asset_id) REFERENCES file_assets(id) ON DELETE SET NULL',
  ],
  [
    'merchant_profiles',
    'merchant_profiles_cover_asset_id_fkey',
    'FOREIGN KEY (cover_asset_id) REFERENCES file_assets(id) ON DELETE SET NULL',
  ],
  [
    'merchant_profiles',
    'merchant_profiles_cv_asset_id_fkey',
    'FOREIGN KEY (cv_asset_id) REFERENCES file_assets(id) ON DELETE SET NULL',
  ],
  [
    'merchant_profiles',
    'merchant_profiles_merchant_id_fkey',
    'FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE',
  ],
  [
    'merchant_members',
    'merchant_members_invited_by_user_id_fkey',
    'FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE SET NULL',
  ],
  [
    'merchant_members',
    'merchant_members_merchant_id_fkey',
    'FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE',
  ],
  [
    'merchant_members',
    'merchant_members_user_id_fkey',
    'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  ],
  [
    'mentors',
    'mentors_user_id_fkey',
    'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  ],
  [
    'mentor_profiles',
    'mentor_profiles_cv_asset_id_fkey',
    'FOREIGN KEY (cv_asset_id) REFERENCES file_assets(id) ON DELETE RESTRICT',
  ],
  [
    'mentor_profiles',
    'mentor_profiles_mentor_id_fkey',
    'FOREIGN KEY (mentor_id) REFERENCES mentors(id) ON DELETE CASCADE',
  ],
  [
    'mentor_profiles',
    'mentor_profiles_skill_certificate_asset_id_fkey',
    'FOREIGN KEY (skill_certificate_asset_id) REFERENCES file_assets(id) ON DELETE RESTRICT',
  ],
  [
    'user_profiles',
    'user_profiles_avatar_asset_id_fkey',
    'FOREIGN KEY (avatar_asset_id) REFERENCES file_assets(id) ON DELETE SET NULL',
  ],
  [
    'user_profiles',
    'user_profiles_user_id_fkey',
    'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  ],
  [
    'user_notification_preferences',
    'user_notification_preferences_user_id_fkey',
    'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  ],
  [
    'coupons',
    'coupons_deleted_by_fkey',
    'FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL',
  ],
  [
    'coupons',
    'coupons_merchant_id_fkey',
    'FOREIGN KEY (merchant_id) REFERENCES merchants(id)',
  ],
  [
    'products',
    'products_cover_asset_id_fkey',
    'FOREIGN KEY (cover_asset_id) REFERENCES file_assets(id) ON DELETE SET NULL',
  ],
  [
    'products',
    'products_merchant_id_fkey',
    'FOREIGN KEY (merchant_id) REFERENCES merchants(id)',
  ],
  [
    'user_access',
    'user_access_product_id_fkey',
    'FOREIGN KEY (product_id) REFERENCES products(id)',
  ],
  [
    'user_access',
    'user_access_user_id_fkey',
    'FOREIGN KEY (user_id) REFERENCES users(id)',
  ],
  [
    'issued_certificates',
    'issued_certificates_access_id_fkey',
    'FOREIGN KEY (access_id) REFERENCES user_access(id)',
  ],
  [
    'issued_certificates',
    'issued_certificates_certificate_asset_id_fkey',
    'FOREIGN KEY (certificate_asset_id) REFERENCES file_assets(id) ON DELETE SET NULL',
  ],
  [
    'issued_certificates',
    'issued_certificates_product_id_fkey',
    'FOREIGN KEY (product_id) REFERENCES products(id)',
  ],
  [
    'issued_certificates',
    'issued_certificates_user_id_fkey',
    'FOREIGN KEY (user_id) REFERENCES users(id)',
  ],
  [
    'student_progress',
    'student_progress_access_id_fkey',
    'FOREIGN KEY (access_id) REFERENCES user_access(id)',
  ],
  [
    'student_progress',
    'student_progress_last_video_id_fkey',
    'FOREIGN KEY (last_video_id) REFERENCES videos(id) ON DELETE SET NULL',
  ],
  [
    'help_tickets',
    'help_tickets_user_id_fkey',
    'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  ],
];

const RESTORED_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_coupons_merchant_created ON coupons (merchant_id, created_at DESC) WHERE deleted_at IS NULL',
  'CREATE INDEX IF NOT EXISTS idx_coupons_public_discovery ON coupons (is_active, starts_at, expires_at, created_at DESC) WHERE deleted_at IS NULL',
  'CREATE INDEX IF NOT EXISTS idx_help_tickets_user_created ON help_tickets (user_id, created_at DESC) WHERE deleted_at IS NULL',
  'CREATE INDEX IF NOT EXISTS idx_mentors_active_user ON mentors (user_id) WHERE deleted_at IS NULL',
  'CREATE INDEX IF NOT EXISTS idx_merchant_members_user ON merchant_members (user_id) WHERE deleted_at IS NULL',
  'CREATE INDEX IF NOT EXISTS idx_products_merchant_discovery ON products (merchant_id, publication_status, created_at DESC) WHERE deleted_at IS NULL',
  'CREATE INDEX IF NOT EXISTS idx_products_public_discovery ON products (publication_status, product_type, published_at DESC, created_at DESC) WHERE deleted_at IS NULL',
  'CREATE INDEX IF NOT EXISTS idx_user_access_user_expiry ON user_access (user_id, expires_at) WHERE deleted_at IS NULL',
];

// Lookup indexes for class-model foreign keys; synchronization never created them.
const CLASS_LOOKUP_INDEXES: [name: string, definition: string][] = [
  ['idx_classes_merchant', 'classes (merchant_id) WHERE deleted_at IS NULL'],
  ['idx_enrollments_user', 'enrollments (user_id) WHERE deleted_at IS NULL'],
  ['idx_enrollments_class', 'enrollments (class_id) WHERE deleted_at IS NULL'],
  ['idx_chapters_class', 'chapters (class_id) WHERE deleted_at IS NULL'],
  [
    'idx_meetings_class_schedule',
    'meetings (class_id, "date", "time") WHERE deleted_at IS NULL',
  ],
  ['idx_assignments_class', 'assignments (class_id) WHERE deleted_at IS NULL'],
  [
    'idx_certificates_user_class',
    'certificates (user_id, class_id) WHERE deleted_at IS NULL',
  ],
];

/**
 * Brings a migration-built database and a previously synchronized database to
 * the same schema: current entity column shapes plus every migration-defined
 * constraint, default, and index those shapes do not contradict.
 */
export class RestoreSchemaIntegrity1790840000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.convergeProducts(queryRunner);
    await queryRunner.query(`
      ALTER TABLE mentor_profiles
        ALTER COLUMN expertise DROP NOT NULL,
        ALTER COLUMN experience_years DROP NOT NULL,
        ALTER COLUMN education DROP NOT NULL,
        ALTER COLUMN linkedin_url DROP NOT NULL
    `);

    for (const [table, column] of RETYPED_IDENTIFIERS) {
      await this.retypeIdentifier(queryRunner, table, column);
    }

    for (const [table, column, value] of RESTORED_DEFAULTS) {
      await queryRunner.query(
        `ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT ${value}`,
      );
    }

    for (const [table, name, definition] of RESTORED_CONSTRAINTS) {
      await this.addConstraintIfMissing(queryRunner, table, name, definition);
    }

    for (const statement of RESTORED_INDEXES) {
      await queryRunner.query(statement);
    }

    for (const [name, definition] of CLASS_LOOKUP_INDEXES) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS ${name} ON ${definition}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restored integrity and uuid identifiers are not reverted: doing so would
    // recreate the defect. Only the lookup indexes introduced here are removed.
    for (const [name] of CLASS_LOOKUP_INDEXES) {
      await queryRunner.query(`DROP INDEX IF EXISTS ${name}`);
    }
  }

  /**
   * A migration-built database still has the ERD `price` column and three
   * columns the product entity no longer maps; synchronized databases already
   * match the entity.
   */
  private async convergeProducts(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'price'
        ) THEN
          ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_price numeric;
          UPDATE products SET discount_price = price WHERE discount_price IS NULL;
          ALTER TABLE products ALTER COLUMN discount_price SET NOT NULL;
          ALTER TABLE products DROP COLUMN price;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE products
        DROP COLUMN IF EXISTS customer_email_instructions,
        DROP COLUMN IF EXISTS updated_by,
        DROP COLUMN IF EXISTS deleted_by
    `);
  }

  private async retypeIdentifier(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        invalid_count integer;
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${table}'
            AND column_name = '${column}' AND data_type <> 'uuid'
        ) THEN
          SELECT count(*) INTO invalid_count FROM ${table}
          WHERE ${column} IS NOT NULL AND ${column} !~ '${UUID_PATTERN}';

          IF invalid_count > 0 THEN
            RAISE EXCEPTION '% row(s) in ${table}.${column} are not UUIDs', invalid_count;
          END IF;

          ALTER TABLE ${table} ALTER COLUMN ${column} TYPE uuid USING ${column}::uuid;
        END IF;
      END $$
    `);
  }

  private async addConstraintIfMissing(
    queryRunner: QueryRunner,
    table: string,
    name: string,
    definition: string,
  ): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT 1 FROM pg_constraint
       WHERE conrelid = $1::regclass
         AND (conname = $2 OR pg_get_constraintdef(oid) = $3)`,
      [table, name, definition],
    );

    if (existing.length === 0) {
      await queryRunner.query(
        `ALTER TABLE ${table} ADD CONSTRAINT ${name} ${definition}`,
      );
    }
  }
}
