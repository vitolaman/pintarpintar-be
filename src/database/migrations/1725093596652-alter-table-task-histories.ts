import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterTableTaskHistories1725093596652
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks_histories" DROP COLUMN IF EXISTS "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks_histories" DROP COLUMN IF EXISTS "taskId"`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async down(queryRunner: QueryRunner): Promise<void> {}
}
