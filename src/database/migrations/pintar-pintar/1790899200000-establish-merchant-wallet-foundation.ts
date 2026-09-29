import { MigrationInterface, QueryRunner } from 'typeorm';

export class EstablishMerchantWalletFoundation1790899200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE merchant_storage_level_enum AS ENUM ('basic', 'silver', 'gold')
    `);
    await queryRunner.query(`
      ALTER TABLE merchants
      ADD COLUMN storage_level merchant_storage_level_enum NOT NULL DEFAULT 'basic'
    `);
    await queryRunner.query(`
      CREATE TABLE merchant_wallets (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE CASCADE,
        balance numeric NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(`
      INSERT INTO merchant_wallets (merchant_id, balance)
      SELECT id, balance FROM merchants
    `);
    await queryRunner.query('ALTER TABLE merchants DROP COLUMN balance');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE merchants ADD COLUMN balance numeric NOT NULL DEFAULT 0',
    );
    await queryRunner.query(`
      UPDATE merchants AS merchant
      SET balance = wallet.balance
      FROM merchant_wallets AS wallet
      WHERE wallet.merchant_id = merchant.id
    `);
    await queryRunner.query('DROP TABLE merchant_wallets');
    await queryRunner.query('ALTER TABLE merchants DROP COLUMN storage_level');
    await queryRunner.query('DROP TYPE merchant_storage_level_enum');
  }
}
