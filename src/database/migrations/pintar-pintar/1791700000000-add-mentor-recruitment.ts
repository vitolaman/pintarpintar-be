import { MigrationInterface, QueryRunner } from 'typeorm';

const JOB_CATEGORIES = [
  'Pemrograman & Teknologi',
  'Desain Teknik & Arsitektur',
  'Pemasaran & Bisnis',
  'Pengembangan Karier & Soft Skill',
  'Lainnya / Multidisiplin',
];
const CONTRACT_TYPES = ['Part-Time', 'Full-Time'];
const WORK_TYPES = ['Remote', 'Hybrid', 'On-Site'];
const JOB_STATUSES = ['active', 'closed'];
const APPLICATION_STATUSES = ['review', 'interview', 'accepted', 'rejected'];

const quoted = (values: string[]) =>
  values.map((value) => `'${value}'`).join(', ');

/**
 * Adds merchant teaching vacancies and the applications to them (Karir job
 * board, "Lowongan Mentor" and "Progress Lamaran"). Safe to re-run.
 */
export class AddMentorRecruitment1791700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS job_postings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL REFERENCES merchants(id),
        class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
        title varchar(150) NOT NULL,
        category varchar(60) NOT NULL,
        contract_type varchar(20) NOT NULL,
        work_type varchar(20) NOT NULL,
        location varchar(150) NOT NULL,
        salary varchar(100) NOT NULL,
        requirements text NOT NULL,
        skills text[] NOT NULL DEFAULT '{}',
        status varchar(20) NOT NULL DEFAULT 'active',
        closed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        job_posting_id uuid NOT NULL REFERENCES job_postings(id),
        applicant_user_id uuid NOT NULL REFERENCES users(id),
        name varchar(150) NOT NULL,
        email varchar(255) NOT NULL,
        phone varchar(32) NOT NULL,
        linkedin_url varchar(500) NOT NULL,
        cv_asset_id uuid NOT NULL REFERENCES file_assets(id),
        note text,
        status varchar(20) NOT NULL DEFAULT 'review',
        interview_at timestamptz,
        interview_url varchar(500),
        decided_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);

    const checks: Array<[table: string, name: string, condition: string]> = [
      [
        'job_postings',
        'chk_job_postings_category',
        `category IN (${quoted(JOB_CATEGORIES)})`,
      ],
      [
        'job_postings',
        'chk_job_postings_contract_type',
        `contract_type IN (${quoted(CONTRACT_TYPES)})`,
      ],
      [
        'job_postings',
        'chk_job_postings_work_type',
        `work_type IN (${quoted(WORK_TYPES)})`,
      ],
      [
        'job_postings',
        'chk_job_postings_status',
        `status IN (${quoted(JOB_STATUSES)})`,
      ],
      [
        'job_applications',
        'chk_job_applications_status',
        `status IN (${quoted(APPLICATION_STATUSES)})`,
      ],
    ];
    for (const [table, name, condition] of checks) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
            ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${condition});
          END IF;
        END $$
      `);
    }

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_job_postings_board ON job_postings (status, created_at DESC) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_job_postings_merchant ON job_postings (merchant_id, created_at DESC) WHERE deleted_at IS NULL',
      // One application per applicant and vacancy.
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_job_applications_applicant ON job_applications (job_posting_id, applicant_user_id) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_job_applications_applicant ON job_applications (applicant_user_id, created_at DESC) WHERE deleted_at IS NULL',
      'CREATE INDEX IF NOT EXISTS idx_job_applications_job_status ON job_applications (job_posting_id, status) WHERE deleted_at IS NULL',
    ];
    for (const index of indexes) {
      await queryRunner.query(index);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS job_applications');
    await queryRunner.query('DROP TABLE IF EXISTS job_postings');
  }
}
