import { MigrationInterface, QueryRunner } from 'typeorm';

const CLASS_CATEGORIES = [
  'Coding',
  'Elektro',
  'Mesin',
  'Desain',
  'Sipil',
  'Kimia',
];
const LEARNING_LEVELS = ['Pemula', 'Menengah', 'Mahir'];

const quoted = (values: string[]) =>
  values.map((value) => `'${value}'`).join(', ');

/**
 * Adds the class details collected by the merchant create-class form, and
 * the payout account and fee of merchant withdrawals. Safe to re-run.
 */
export class AddClassDetailsAndWithdrawals1791500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE classes
        ADD COLUMN IF NOT EXISTS category varchar(20),
        ADD COLUMN IF NOT EXISTS level varchar(20),
        ADD COLUMN IF NOT EXISTS duration varchar(60),
        ADD COLUMN IF NOT EXISTS prerequisites text,
        ADD COLUMN IF NOT EXISTS learning_outcomes jsonb
    `);
    const checks: Array<[name: string, condition: string]> = [
      [
        'chk_classes_category',
        `category IS NULL OR category IN (${quoted(CLASS_CATEGORIES)})`,
      ],
      [
        'chk_classes_level',
        `level IS NULL OR level IN (${quoted(LEARNING_LEVELS)})`,
      ],
      [
        'chk_classes_learning_outcomes',
        `learning_outcomes IS NULL OR jsonb_typeof(learning_outcomes) = 'array'`,
      ],
    ];
    for (const [name, condition] of checks) {
      const [{ violations }] = await queryRunner.query(
        `SELECT count(*)::integer AS violations FROM classes WHERE NOT (${condition})`,
      );
      if (violations > 0) {
        throw new Error(
          `Cannot add ${name}: ${violations} classes violate it. Resolve them before migrating.`,
        );
      }
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
            ALTER TABLE classes ADD CONSTRAINT ${name} CHECK (${condition});
          END IF;
        END $$
      `);
    }
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_classes_category_level ON classes (category, level) WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(`
      ALTER TABLE merchant_payouts
        ADD COLUMN IF NOT EXISTS payout_account_id uuid,
        ADD COLUMN IF NOT EXISTS fee_amount numeric NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'merchant_payouts_payout_account_id_fkey') THEN
          ALTER TABLE merchant_payouts ADD CONSTRAINT merchant_payouts_payout_account_id_fkey
            FOREIGN KEY (payout_account_id) REFERENCES merchant_payout_accounts(id) ON DELETE SET NULL;
        END IF;
      END $$
    `);

    const [{ invalidPayouts }] = await queryRunner.query(
      'SELECT count(*)::integer AS "invalidPayouts" FROM merchant_payouts WHERE NOT (amount > 0 AND fee_amount >= 0 AND fee_amount < amount)',
    );
    if (invalidPayouts > 0) {
      throw new Error(
        `Cannot add chk_merchant_payouts_amounts: ${invalidPayouts} payouts violate it. Resolve them before migrating.`,
      );
    }
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_merchant_payouts_amounts') THEN
          ALTER TABLE merchant_payouts ADD CONSTRAINT chk_merchant_payouts_amounts
            CHECK (amount > 0 AND fee_amount >= 0 AND fee_amount < amount);
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE merchant_payouts DROP CONSTRAINT IF EXISTS chk_merchant_payouts_amounts',
    );
    await queryRunner.query(
      'ALTER TABLE merchant_payouts DROP CONSTRAINT IF EXISTS merchant_payouts_payout_account_id_fkey',
    );
    await queryRunner.query(`
      ALTER TABLE merchant_payouts
        DROP COLUMN IF EXISTS fee_amount,
        DROP COLUMN IF EXISTS payout_account_id
    `);
    await queryRunner.query('DROP INDEX IF EXISTS idx_classes_category_level');
    for (const name of [
      'chk_classes_learning_outcomes',
      'chk_classes_level',
      'chk_classes_category',
    ]) {
      await queryRunner.query(
        `ALTER TABLE classes DROP CONSTRAINT IF EXISTS ${name}`,
      );
    }
    await queryRunner.query(`
      ALTER TABLE classes
        DROP COLUMN IF EXISTS learning_outcomes,
        DROP COLUMN IF EXISTS prerequisites,
        DROP COLUMN IF EXISTS duration,
        DROP COLUMN IF EXISTS level,
        DROP COLUMN IF EXISTS category
    `);
  }
}
