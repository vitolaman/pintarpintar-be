import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AlterColumnYearlyLeaderboard1724598128592
  implements MigrationInterface
{
  private tableName = 'yearly_leaderboard';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns(this.tableName, [
      new TableColumn({
        name: 'type',
        type: 'integer',
        isNullable: false,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(this.tableName, 'type');
  }
}
