import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AlterColumnUserToUuidReferrals1724595303069
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'referrals',
      'user_id_ref_owner',
      new TableColumn({
        name: 'user_id_ref_owner',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.changeColumn(
      'referrals',
      'user_id_ref_user',
      new TableColumn({
        name: 'user_id_ref_user',
        type: 'uuid',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'referrals',
      'user_id_ref_owner',
      new TableColumn({
        name: 'user_id_ref_owner',
        type: 'varchar',
        isNullable: false,
      }),
    );

    await queryRunner.changeColumn(
      'referrals',
      'user_id_ref_user',
      new TableColumn({
        name: 'user_id_ref_user',
        type: 'varchar',
        isNullable: false,
      }),
    );
  }
}
