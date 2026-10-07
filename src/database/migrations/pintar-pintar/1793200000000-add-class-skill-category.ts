import { MigrationInterface, QueryRunner } from 'typeorm';

const SKILL_CATEGORIES = [
  'Bisnis & Entrepreneurship',
  'Teknologi & Digital',
  'Teknik Sipil',
  'Teknik Informatika',
  'Desain & Kreatif',
  'Marketing & Communication',
  'Keuangan & Investasi',
  'Karier & Profesional',
];

const quoted = (values: string[]) =>
  values.map((value) => `'${value}'`).join(', ');

/**
 * The "Kategori Skill" of the create-class form, separate from Bidang
 * (`category`). Classes created earlier keep null. Safe to re-run.
 */
export class AddClassSkillCategory1793200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE classes ADD COLUMN IF NOT EXISTS skill_category varchar(64)',
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_classes_skill_category') THEN
          ALTER TABLE classes ADD CONSTRAINT chk_classes_skill_category
            CHECK (skill_category IS NULL OR skill_category IN (${quoted(SKILL_CATEGORIES)}));
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE classes DROP CONSTRAINT IF EXISTS chk_classes_skill_category',
    );
    await queryRunner.query(
      'ALTER TABLE classes DROP COLUMN IF EXISTS skill_category',
    );
  }
}
