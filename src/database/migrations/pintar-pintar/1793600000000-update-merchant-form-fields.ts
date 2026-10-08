import { MigrationInterface, QueryRunner } from 'typeorm';

// The five labels of the first job-posting form and the frontend skill
// categories that replace them.
const CATEGORY_MAPPING: Array<[previous: string, current: string]> = [
  ['Pemrograman & Teknologi', 'Teknologi & Digital'],
  ['Desain Teknik & Arsitektur', 'Teknik Sipil'],
  ['Pemasaran & Bisnis', 'Marketing & Communication'],
  ['Pengembangan Karier & Soft Skill', 'Karier & Profesional'],
  ['Lainnya / Multidisiplin', 'Lainnya'],
];
const FALLBACK_PREVIOUS_CATEGORY = 'Lainnya / Multidisiplin';

const quoted = (values: string[]) =>
  values.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ');

/**
 * Follows the updated merchant forms:
 * - job postings take the category label of the form's selector (no fixed
 *   list), and location and salary become optional; postings with one of the
 *   five old labels move to the matching skill category;
 * - digital products get the "Kategori Skill" label, as classes have;
 * - merchant profiles keep the selling-experience answers of registration.
 * Safe to re-run.
 */
export class UpdateMerchantFormFields1793600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE job_postings
        DROP CONSTRAINT IF EXISTS chk_job_postings_category,
        ALTER COLUMN category TYPE varchar(64),
        ALTER COLUMN location DROP NOT NULL,
        ALTER COLUMN salary DROP NOT NULL
    `);
    for (const [previous, current] of CATEGORY_MAPPING) {
      await queryRunner.query(
        'UPDATE job_postings SET category = $2 WHERE category = $1',
        [previous, current],
      );
    }

    await queryRunner.query(
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS skill_category varchar(64)',
    );

    await queryRunner.query(`
      ALTER TABLE merchant_profiles
        ADD COLUMN IF NOT EXISTS has_sold_before boolean,
        ADD COLUMN IF NOT EXISTS product_idea text,
        ADD COLUMN IF NOT EXISTS monthly_revenue_range varchar(100),
        ADD COLUMN IF NOT EXISTS monthly_transaction_range varchar(100),
        ADD COLUMN IF NOT EXISTS sold_products text
    `);
  }

  // Lossy by design: labels without an old counterpart become the old
  // "Lainnya / Multidisiplin", and missing locations and salaries become "-".
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE merchant_profiles
        DROP COLUMN IF EXISTS has_sold_before,
        DROP COLUMN IF EXISTS product_idea,
        DROP COLUMN IF EXISTS monthly_revenue_range,
        DROP COLUMN IF EXISTS monthly_transaction_range,
        DROP COLUMN IF EXISTS sold_products
    `);
    await queryRunner.query(
      'ALTER TABLE products DROP COLUMN IF EXISTS skill_category',
    );

    for (const [previous, current] of CATEGORY_MAPPING) {
      await queryRunner.query(
        'UPDATE job_postings SET category = $1 WHERE category = $2',
        [previous, current],
      );
    }
    const previousLabels = CATEGORY_MAPPING.map(([previous]) => previous);
    await queryRunner.query(
      `UPDATE job_postings SET category = $1
       WHERE category NOT IN (${quoted(previousLabels)})`,
      [FALLBACK_PREVIOUS_CATEGORY],
    );
    await queryRunner.query(
      "UPDATE job_postings SET location = '-' WHERE location IS NULL",
    );
    await queryRunner.query(
      "UPDATE job_postings SET salary = '-' WHERE salary IS NULL",
    );
    await queryRunner.query(`
      ALTER TABLE job_postings
        ALTER COLUMN location SET NOT NULL,
        ALTER COLUMN salary SET NOT NULL,
        ALTER COLUMN category TYPE varchar(60)
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_job_postings_category') THEN
          ALTER TABLE job_postings ADD CONSTRAINT chk_job_postings_category
            CHECK (category IN (${quoted(previousLabels)}));
        END IF;
      END $$
    `);
  }
}
