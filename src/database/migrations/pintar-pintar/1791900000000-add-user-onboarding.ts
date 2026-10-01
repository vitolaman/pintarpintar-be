import { MigrationInterface, QueryRunner } from 'typeorm';

const ONBOARDING_ROLES = [
  'mahasiswa',
  'content_creator',
  'professional',
  'ibu_rumah_tangga',
  'brand_bisnis',
  'custom',
];

/**
 * Stores the role and skills chosen in the onboarding pop-up after signup.
 * Safe to re-run.
 */
export class AddUserOnboarding1791900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_profiles
        ADD COLUMN IF NOT EXISTS onboarding_role varchar(30),
        ADD COLUMN IF NOT EXISTS custom_role varchar(60),
        ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamp
    `);
    const roles = ONBOARDING_ROLES.map((role) => `'${role}'`).join(', ');
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_profiles_onboarding_role') THEN
          ALTER TABLE user_profiles ADD CONSTRAINT chk_user_profiles_onboarding_role
            CHECK (onboarding_role IS NULL OR onboarding_role IN (${roles}));
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS chk_user_profiles_onboarding_role',
    );
    await queryRunner.query(`
      ALTER TABLE user_profiles
        DROP COLUMN IF EXISTS onboarding_completed_at,
        DROP COLUMN IF EXISTS skills,
        DROP COLUMN IF EXISTS custom_role,
        DROP COLUMN IF EXISTS onboarding_role
    `);
  }
}
