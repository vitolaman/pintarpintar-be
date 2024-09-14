import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterAddFromDateLeaderboardCreateTableCategoryLeaderboard1726308126647
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "weekly_prediction_leaderboard"
      ADD "from_date" TIMESTAMP NOT NULL,
      ADD "to_date" TIMESTAMP NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "monthly_referral_leaderboard"
      ADD "from_date" TIMESTAMP NOT NULL,
      ADD "to_date" TIMESTAMP NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "yearly_leaderboard"
      ADD "from_date" TIMESTAMP NOT NULL,
      ADD "to_date" TIMESTAMP NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE "weekly_leaderboard_category" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "counter" integer NOT NULL,
        "name" character varying NOT NULL,
        "from_date" TIMESTAMP NOT NULL,
        "to_date" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_weekly_leaderboard_category_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "monthly_leaderboard_category" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "counter" integer NOT NULL,
        "name" character varying NOT NULL,
        "from_date" TIMESTAMP NOT NULL,
        "to_date" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_montly_leaderboard_category_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "yearly_leaderboard_category" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "counter" integer NOT NULL,
        "name" character varying NOT NULL,
        "from_date" TIMESTAMP NOT NULL,
        "to_date" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_yearly_leaderboard_category_id" PRIMARY KEY ("id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "weekly_prediction_leaderboard"
      DROP COLUMN "from_date",
      DROP COLUMN "to_date";
    `);

    await queryRunner.query(`
      ALTER TABLE "monthly_referral_leaderboard"
      DROP COLUMN "from_date",
      DROP COLUMN "to_date";
    `);

    await queryRunner.query(`
      ALTER TABLE "yearly_leaderboard"
      DROP COLUMN "from_date",
      DROP COLUMN "to_date";
    `);

    await queryRunner.query(`
      DROP TABLE "weekly_leaderboard_category";
    `);

    await queryRunner.query(`
      DROP TABLE "montly_leaderboard_category";
    `);

    await queryRunner.query(`
      DROP TABLE "yearly_leaderboard_category";
    `);
  }
}
