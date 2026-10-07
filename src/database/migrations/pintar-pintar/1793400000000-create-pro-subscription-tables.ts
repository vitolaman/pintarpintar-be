import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pintar Pintar Pro for merchants: the plans that can be offered and each
 * merchant's Pro periods. Pro status is derived from the periods, so no
 * merchant column changes. A period copies its plan's name, duration and
 * price, so a later plan change does not alter it; a manual grant may have
 * no plan. No rows are inserted. Safe to re-run.
 */
export class CreateProSubscriptionTables1793400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pro_plans (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(40) NOT NULL,
        name varchar(80) NOT NULL,
        duration_months integer NOT NULL,
        price numeric NOT NULL,
        is_offered boolean NOT NULL DEFAULT false,
        display_order integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_pro_plans_duration_months
          CHECK (duration_months BETWEEN 1 AND 36),
        CONSTRAINT chk_pro_plans_price CHECK (price > 0)
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_plans_code ON pro_plans (code) WHERE deleted_at IS NULL',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS merchant_pro_periods (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        merchant_id uuid NOT NULL REFERENCES merchants (id) ON DELETE RESTRICT,
        plan_id uuid REFERENCES pro_plans (id) ON DELETE RESTRICT,
        plan_name varchar(80),
        duration_months integer,
        price numeric,
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        source varchar(16) NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'active',
        note varchar(500),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp,
        CONSTRAINT chk_merchant_pro_periods_dates CHECK (ends_at > starts_at),
        CONSTRAINT chk_merchant_pro_periods_plan_terms CHECK (
          plan_id IS NULL
          OR (plan_name IS NOT NULL AND duration_months IS NOT NULL AND price IS NOT NULL)
        ),
        CONSTRAINT chk_merchant_pro_periods_duration_months
          CHECK (duration_months BETWEEN 1 AND 36),
        CONSTRAINT chk_merchant_pro_periods_price CHECK (price >= 0),
        CONSTRAINT chk_merchant_pro_periods_source
          CHECK (source IN ('payment', 'manual')),
        CONSTRAINT chk_merchant_pro_periods_status
          CHECK (status IN ('active', 'cancelled'))
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_merchant_pro_periods_merchant_end ON merchant_pro_periods (merchant_id, ends_at) WHERE deleted_at IS NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS merchant_pro_periods');
    await queryRunner.query('DROP TABLE IF EXISTS pro_plans');
  }
}
