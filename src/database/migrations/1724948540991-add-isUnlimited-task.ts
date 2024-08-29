import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsUnlimitedTask1724948540991 implements MigrationInterface {
  name = 'AddIsUnlimitedTask1724948540991';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "master_tasks" ADD "isUnlimited" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "master_tasks" ADD "repeatableType" integer NOT NULL DEFAULT '1'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "master_tasks" DROP COLUMN "repeatableType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "master_tasks" DROP COLUMN "isUnlimited"`,
    );
  }
}
