import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRepeatableTask1724945408860 implements MigrationInterface {
  name = 'AddRepeatableTask1724945408860';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "master_tasks" ADD "token" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "master_tasks" ADD "isRepeatable" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "master_tasks" ADD "max_repeat" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "master_tasks" DROP COLUMN "max_repeat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "master_tasks" DROP COLUMN "isRepeatable"`,
    );
    await queryRunner.query(`ALTER TABLE "master_tasks" DROP COLUMN "token"`);
  }
}
