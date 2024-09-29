import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoginStreakMetadataMasterTask1727605495830
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE master_tasks
      ADD COLUMN login_streak_metadata INTEGER[] NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE master_tasks
      DROP COLUMN login_streak_metadata;
    `);
  }
}
