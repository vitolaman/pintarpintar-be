import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AlterAddColumnCountRef1724493138687 implements MigrationInterface {
  private tableName = 'users';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns(this.tableName, [
      new TableColumn({
        name: 'count_referrals',
        type: 'bigint',
        default: 0,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(this.tableName, 'count_referrals');
  }
}
