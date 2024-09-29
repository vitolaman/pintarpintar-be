import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterAddStreakUser1727600996184 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD "login_streak" integer NOT NULL DEFAULT 0,
      ADD "last_login_task_date" TIMESTAMP;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN "login_streak",
      DROP COLUMN "last_login_task_date";
    `);
  }
}
