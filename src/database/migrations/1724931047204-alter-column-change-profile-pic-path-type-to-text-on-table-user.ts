import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterColumnChangeProfilePicPathTypeToTextOnTableUser1724931047204
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "profile_pic_path" TYPE text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "profile_pic_path" TYPE varchar(255)`,
    );
  }
}
