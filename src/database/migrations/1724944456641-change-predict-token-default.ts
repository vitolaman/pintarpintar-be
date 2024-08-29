import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangePredictTokenDefault1724944456641
  implements MigrationInterface
{
  name = 'ChangePredictTokenDefault1724944456641';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "predict_token" SET DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "predict_token" SET DEFAULT '5'`,
    );
  }
}
