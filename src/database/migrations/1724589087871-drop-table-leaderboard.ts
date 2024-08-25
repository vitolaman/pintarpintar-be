import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropTableLeaderboard1724589087871 implements MigrationInterface {
  private tableNameMonthlyPredictLeaderboard = 'monthly_prediction_leaderboard';
  private tableNameYearlyPredictLeaderboard = 'yearly_prediction_leaderboard';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${this.tableNameMonthlyPredictLeaderboard} DROP CONSTRAINT fk_${this.tableNameMonthlyPredictLeaderboard}_user_id;`,
    );

    await queryRunner.query(
      `ALTER TABLE ${this.tableNameYearlyPredictLeaderboard} DROP CONSTRAINT fk_${this.tableNameYearlyPredictLeaderboard}_user_id;`,
    );

    await queryRunner.dropTable(this.tableNameMonthlyPredictLeaderboard);
    await queryRunner.dropTable(this.tableNameYearlyPredictLeaderboard);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async down(queryRunner: QueryRunner): Promise<void> {}
}
