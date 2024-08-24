import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateTableLeaderboard1724499878541 implements MigrationInterface {
  private tableNameWeeklyPredictLeaderboard = 'weekly_prediction_leaderboard';
  private tableNameMonthlyPredictLeaderboard = 'monthly_prediction_leaderboard';
  private tableNameYearlyPredictLeaderboard = 'yearly_prediction_leaderboard';
  private tableNameMonthlyReferralLeaderboard = 'monthly_referral_leaderboard';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Weekly Predict
    await queryRunner.createTable(
      new Table({
        name: this.tableNameWeeklyPredictLeaderboard,
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'sum_point',
            type: 'bigint',
            isNullable: false,
            default: '0',
          },
          {
            name: 'created_at',
            type: 'TIMESTAMP',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'TIMESTAMP',
            isNullable: false,
            default: 'now()',
            onUpdate: 'now()',
          },
          {
            name: 'deleted_at',
            type: 'TIMESTAMP',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Monthly Predict
    await queryRunner.createTable(
      new Table({
        name: this.tableNameMonthlyPredictLeaderboard,
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'sum_point',
            type: 'bigint',
            isNullable: false,
            default: '0',
          },
          {
            name: 'created_at',
            type: 'TIMESTAMP',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'TIMESTAMP',
            isNullable: false,
            default: 'now()',
            onUpdate: 'now()',
          },
          {
            name: 'deleted_at',
            type: 'TIMESTAMP',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Yearly Predict
    await queryRunner.createTable(
      new Table({
        name: this.tableNameYearlyPredictLeaderboard,
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'sum_point',
            type: 'bigint',
            isNullable: false,
            default: '0',
          },
          {
            name: 'created_at',
            type: 'TIMESTAMP',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'TIMESTAMP',
            isNullable: false,
            default: 'now()',
            onUpdate: 'now()',
          },
          {
            name: 'deleted_at',
            type: 'TIMESTAMP',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Monthly Ref
    await queryRunner.createTable(
      new Table({
        name: this.tableNameMonthlyReferralLeaderboard,
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'sum_point',
            type: 'bigint',
            isNullable: false,
            default: '0',
          },
          {
            name: 'created_at',
            type: 'TIMESTAMP',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'TIMESTAMP',
            isNullable: false,
            default: 'now()',
            onUpdate: 'now()',
          },
          {
            name: 'deleted_at',
            type: 'TIMESTAMP',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `ALTER TABLE ${this.tableNameWeeklyPredictLeaderboard} ADD CONSTRAINT fk_${this.tableNameWeeklyPredictLeaderboard}_user_id FOREIGN KEY (user_id)
				REFERENCES
				users(id) ON UPDATE CASCADE ON DELETE CASCADE;`,
    );

    await queryRunner.query(
      `ALTER TABLE ${this.tableNameMonthlyPredictLeaderboard} ADD CONSTRAINT fk_${this.tableNameMonthlyPredictLeaderboard}_user_id FOREIGN KEY (user_id)
				REFERENCES
				users(id) ON UPDATE CASCADE ON DELETE CASCADE;`,
    );

    await queryRunner.query(
      `ALTER TABLE ${this.tableNameYearlyPredictLeaderboard} ADD CONSTRAINT fk_${this.tableNameYearlyPredictLeaderboard}_user_id FOREIGN KEY (user_id)
				REFERENCES
				users(id) ON UPDATE CASCADE ON DELETE CASCADE;`,
    );

    await queryRunner.query(
      `ALTER TABLE ${this.tableNameMonthlyReferralLeaderboard} ADD CONSTRAINT fk_${this.tableNameMonthlyReferralLeaderboard}_user_id FOREIGN KEY (user_id)
				REFERENCES
				users(id) ON UPDATE CASCADE ON DELETE CASCADE;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${this.tableNameWeeklyPredictLeaderboard} DROP FOREIGN KEY fk_${this.tableNameWeeklyPredictLeaderboard}_user_id;`,
    );

    await queryRunner.query(
      `ALTER TABLE ${this.tableNameMonthlyPredictLeaderboard} DROP FOREIGN KEY fk_${this.tableNameMonthlyPredictLeaderboard}_user_id;`,
    );

    await queryRunner.query(
      `ALTER TABLE ${this.tableNameYearlyPredictLeaderboard} DROP FOREIGN KEY fk_${this.tableNameYearlyPredictLeaderboard}_user_id;`,
    );

    await queryRunner.query(
      `ALTER TABLE ${this.tableNameMonthlyReferralLeaderboard} DROP FOREIGN KEY fk_${this.tableNameMonthlyReferralLeaderboard}_user_id;`,
    );

    await queryRunner.dropTable(this.tableNameWeeklyPredictLeaderboard);
    await queryRunner.dropTable(this.tableNameMonthlyPredictLeaderboard);
    await queryRunner.dropTable(this.tableNameYearlyPredictLeaderboard);
    await queryRunner.dropTable(this.tableNameMonthlyReferralLeaderboard);
  }
}
