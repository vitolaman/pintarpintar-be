import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterAddColumnTwitterUsernameUserTable1724943643832
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "twitter_username" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twitter_username"`,
    );
  }
}
