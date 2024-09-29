import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterColumnUserRenameLoginStreak1727610229027
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      RENAME COLUMN "login_streak" TO "login_task_streak";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      RENAME COLUMN "login_task_streak" TO "login_streak";
    `);
  }
}
