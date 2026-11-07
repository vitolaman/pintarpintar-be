import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMerchantProRequests1795200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS merchant_pro_requests (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        message text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_merchant_pro_requests_created
      ON merchant_pro_requests (created_at DESC, id DESC)
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS merchant_pro_requests');
  }
}
