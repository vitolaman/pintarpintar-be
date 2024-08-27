import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateTablePrediction1724674013105 implements MigrationInterface {
  private tablePredictions = 'predictions';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: this.tablePredictions,
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
            name: 'sport',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'category_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'match_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'match_status',
            type: 'integer',
            isNullable: false,
            default: '0',
          },
          {
            name: 'prediction',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'local_team_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'visitor_team_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'partner_data_json',
            type: 'JSON',
            isNullable: true,
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
      `ALTER TABLE ${this.tablePredictions} ADD CONSTRAINT fk_${this.tablePredictions}_user_id FOREIGN KEY (user_id)
				REFERENCES
				users(id) ON UPDATE CASCADE ON DELETE CASCADE;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE ${this.tablePredictions} DROP FOREIGN KEY fk_${this.tablePredictions}_user_id;`,
    );

    await queryRunner.dropTable(this.tablePredictions);
  }
}
