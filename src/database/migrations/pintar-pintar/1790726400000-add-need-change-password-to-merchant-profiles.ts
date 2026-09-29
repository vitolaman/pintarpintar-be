import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNeedChangePasswordToMerchantProfiles1790726400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE merchant_profiles
      ADD COLUMN need_change_password boolean DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE merchant_profiles
      DROP COLUMN need_change_password
    `);
  }
}
