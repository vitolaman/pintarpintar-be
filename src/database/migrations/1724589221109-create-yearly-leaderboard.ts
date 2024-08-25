import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateYearlyLeaderboard1724589221109
  implements MigrationInterface
{
  private tableNameYearlyLeaderboard = 'yearly_leaderboard';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: this.tableNameYearlyLeaderboard,
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
      `ALTER TABLE ${this.tableNameYearlyLeaderboard} ADD CONSTRAINT fk_${this.tableNameYearlyLeaderboard}_user_id FOREIGN KEY (user_id)
				REFERENCES
				users(id) ON UPDATE CASCADE ON DELETE CASCADE;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${this.tableNameYearlyLeaderboard} DROP FOREIGN KEY fk_${this.tableNameYearlyLeaderboard}_user_id;`,
    );

    await queryRunner.dropTable(this.tableNameYearlyLeaderboard);
  }
}
