import { MigrationInterface, QueryRunner } from 'typeorm';

// The labels the first version allowed; only `down` needs them.
const FIRST_LABELS = [
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
 * The Kategori Skill is the label of the FE selector, which owns the options,
 * so the fixed-list check of 1793200000000 is dropped. Safe to re-run.
 */
export class AcceptClassSkillCategoryLabels1793300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE classes DROP CONSTRAINT IF EXISTS chk_classes_skill_category',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const condition = `skill_category IS NULL OR skill_category IN (${quoted(FIRST_LABELS)})`;
    const [{ violations }] = await queryRunner.query(
      `SELECT count(*)::integer AS violations FROM classes WHERE NOT (${condition})`,
    );
    if (violations > 0) {
      throw new Error(
        `Cannot restore chk_classes_skill_category: ${violations} classes have other labels. Change them before reverting.`,
      );
    }
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_classes_skill_category') THEN
          ALTER TABLE classes ADD CONSTRAINT chk_classes_skill_category CHECK (${condition});
        END IF;
      END $$
    `);
  }
}
