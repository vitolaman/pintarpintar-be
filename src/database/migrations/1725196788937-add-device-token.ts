import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceToken1725196788937 implements MigrationInterface {
  name = 'AddDeviceToken1725196788937';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deviceToken" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deviceToken"`);
  }
}
