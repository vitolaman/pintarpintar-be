import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives every merchant a storage tier and one wallet holding its earning,
 * settled (withdrawable), and lifetime amounts. The legacy merchant balance
 * columns are backfilled into the wallet and removed. Safe to re-run.
 */
export class EstablishMerchantWalletFoundation1790899200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'merchant_storage_level_enum') THEN
          CREATE TYPE merchant_storage_level_enum AS ENUM ('basic', 'silver', 'gold');
        END IF;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE merchants
      ADD COLUMN IF NOT EXISTS storage_level merchant_storage_level_enum NOT NULL DEFAULT 'basic'
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS merchant_wallets (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE CASCADE,
        earning_balance numeric NOT NULL DEFAULT 0,
        settled_balance numeric NOT NULL DEFAULT 0,
        lifetime_earnings numeric NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_merchant_wallets_non_negative CHECK (
          earning_balance >= 0 AND settled_balance >= 0 AND lifetime_earnings >= 0
        ),
        CONSTRAINT chk_merchant_wallets_settled_within_earning CHECK (
          settled_balance <= earning_balance
        )
      )
    `);

    // The legacy model had no clearing period, so its balance was fully settled.
    await queryRunner.query(`
      DO $$
      DECLARE
        has_balance boolean := EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'merchants' AND column_name = 'balance'
        );
        has_lifetime boolean := EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'merchants' AND column_name = 'lifetime_earnings'
        );
      BEGIN
        EXECUTE format(
          'INSERT INTO merchant_wallets (merchant_id, earning_balance, settled_balance, lifetime_earnings)
           SELECT merchant.id, %1$s, %1$s, %2$s
           FROM merchants merchant
           WHERE NOT EXISTS (SELECT 1 FROM merchant_wallets wallet WHERE wallet.merchant_id = merchant.id)',
          CASE WHEN has_balance THEN 'merchant.balance' ELSE '0' END,
          CASE WHEN has_lifetime THEN 'merchant.lifetime_earnings' ELSE '0' END
        );
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE merchants
        DROP COLUMN IF EXISTS balance,
        DROP COLUMN IF EXISTS lifetime_earnings
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE merchants
        ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS lifetime_earnings numeric NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      UPDATE merchants AS merchant
      SET balance = wallet.earning_balance,
          lifetime_earnings = wallet.lifetime_earnings
      FROM merchant_wallets AS wallet
      WHERE wallet.merchant_id = merchant.id
    `);
    await queryRunner.query('DROP TABLE IF EXISTS merchant_wallets');
    await queryRunner.query(
      'ALTER TABLE merchants DROP COLUMN IF EXISTS storage_level',
    );
    await queryRunner.query('DROP TYPE IF EXISTS merchant_storage_level_enum');
  }
}
