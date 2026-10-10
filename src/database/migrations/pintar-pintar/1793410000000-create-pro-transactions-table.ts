import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pro subscription transactions tracking. Similar to orders, each merchant
 * subscription attempt creates a transaction that moves from pending to paid
 * (or failed/expired). A paid transaction creates a corresponding Pro period.
 * Safe to re-run.
 */
export class CreateProTransactionsTables1793410000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pro_transactions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        merchant_id uuid NOT NULL REFERENCES merchants (id) ON DELETE RESTRICT,
        plan_id uuid NOT NULL REFERENCES pro_plans (id) ON DELETE RESTRICT,
        transaction_number varchar(20),
        discount_code_id uuid REFERENCES discount_codes (id) ON DELETE SET NULL,
        plan_name varchar(80),
        duration_months integer,
        total_amount numeric NOT NULL,
        discount_amount numeric NOT NULL DEFAULT 0,
        status varchar(16) NOT NULL DEFAULT 'pending',
        payment_gateway_ref varchar(255),
        payment_url text,
        payment_method varchar(20),
        expires_at timestamp,
        paid_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_pro_transactions_total_amount CHECK (total_amount >= 0),
        CONSTRAINT chk_pro_transactions_discount_amount CHECK (discount_amount >= 0),
        CONSTRAINT chk_pro_transactions_status
          CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'cancelled'))
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_transactions_number ON pro_transactions (transaction_number) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_pro_transactions_user ON pro_transactions (user_id, created_at DESC) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_pro_transactions_merchant ON pro_transactions (merchant_id, created_at DESC) WHERE deleted_at IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS pro_transactions');
  }
}
