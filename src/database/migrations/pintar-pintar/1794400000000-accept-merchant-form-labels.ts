import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Jenis Merchant becomes the registration form's label, stored as sent while
 * the form still changes (owner, 2026-10-13): the fixed-value check goes and
 * the column takes the 64-character label. Existing values are kept. Safe to
 * re-run.
 */
export class AcceptMerchantFormLabels1794400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE merchant_profiles DROP CONSTRAINT IF EXISTS chk_merchant_profiles_business_type',
    );
    await queryRunner.query(
      'ALTER TABLE merchant_profiles ALTER COLUMN business_type TYPE varchar(64)',
    );
  }

  // NOT VALID keeps labels stored under the new rule from blocking a
  // rollback; new writes are checked again. The column stays 64 wide, which
  // the previous code also accepts.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_merchant_profiles_business_type') THEN
          ALTER TABLE merchant_profiles
            ADD CONSTRAINT chk_merchant_profiles_business_type
            CHECK (business_type IN ('individual', 'institution', 'company')) NOT VALID;
        END IF;
      END $$
    `);
  }
}
