import { MigrationInterface, QueryRunner } from 'typeorm';

const CONSTRAINTS: Array<[name: string, check: string]> = [
  [
    'chk_merchant_profiles_business_type',
    "business_type IN ('individual', 'institution', 'company')",
  ],
  [
    'chk_merchant_profiles_product_types',
    "product_types <@ ARRAY['kelas', 'bootcamp', 'digital']::text[] AND cardinality(product_types) BETWEEN 1 AND 3",
  ],
];

/**
 * Stores the merchant registration form's Jenis Merchant and Produk yang
 * Ingin Dijual answers. Both stay null for merchants that registered before
 * the form asked for them. Safe to re-run.
 */
export class AddMerchantOnboardingAnswers1792800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE merchant_profiles
        ADD COLUMN IF NOT EXISTS business_type varchar(20),
        ADD COLUMN IF NOT EXISTS product_types text[]
    `);
    for (const [name, check] of CONSTRAINTS) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
            ALTER TABLE merchant_profiles ADD CONSTRAINT ${name} CHECK (${check});
          END IF;
        END $$
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [name] of CONSTRAINTS) {
      await queryRunner.query(
        `ALTER TABLE merchant_profiles DROP CONSTRAINT IF EXISTS ${name}`,
      );
    }
    await queryRunner.query(`
      ALTER TABLE merchant_profiles
        DROP COLUMN IF EXISTS product_types,
        DROP COLUMN IF EXISTS business_type
    `);
  }
}
