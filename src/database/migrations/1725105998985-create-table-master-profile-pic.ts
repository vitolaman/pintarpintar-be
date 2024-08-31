import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateTableMasterProfilePic1725105998985
  implements MigrationInterface
{
  private table = 'master_profile_picture';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: this.table,
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'imagePath',
            type: 'text',
            isNullable: false,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
  }
}
