import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPredictTokenUser1724669063051 implements MigrationInterface {
  name = 'AddPredictTokenUser1724669063051';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "monthly_referral_leaderboard" DROP CONSTRAINT "fk_monthly_referral_leaderboard_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_prediction_leaderboard" DROP CONSTRAINT "fk_weekly_prediction_leaderboard_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "yearly_leaderboard" DROP CONSTRAINT "fk_yearly_leaderboard_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "predict_token" integer DEFAULT '5'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "count_referrals"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "count_referrals" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "monthly_referral_leaderboard" DROP COLUMN "sum_point"`,
    );
    await queryRunner.query(
      `ALTER TABLE "monthly_referral_leaderboard" ADD "sum_point" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_prediction_leaderboard" DROP COLUMN "sum_point"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_prediction_leaderboard" ADD "sum_point" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "yearly_leaderboard" DROP COLUMN "sum_point"`,
    );
    await queryRunner.query(
      `ALTER TABLE "yearly_leaderboard" ADD "sum_point" integer NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "yearly_leaderboard" DROP COLUMN "sum_point"`,
    );
    await queryRunner.query(
      `ALTER TABLE "yearly_leaderboard" ADD "sum_point" bigint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_prediction_leaderboard" DROP COLUMN "sum_point"`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_prediction_leaderboard" ADD "sum_point" bigint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "monthly_referral_leaderboard" DROP COLUMN "sum_point"`,
    );
    await queryRunner.query(
      `ALTER TABLE "monthly_referral_leaderboard" ADD "sum_point" bigint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "count_referrals"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "count_referrals" bigint NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "predict_token"`);
    await queryRunner.query(
      `ALTER TABLE "yearly_leaderboard" ADD CONSTRAINT "fk_yearly_leaderboard_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "weekly_prediction_leaderboard" ADD CONSTRAINT "fk_weekly_prediction_leaderboard_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "monthly_referral_leaderboard" ADD CONSTRAINT "fk_monthly_referral_leaderboard_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }
}
