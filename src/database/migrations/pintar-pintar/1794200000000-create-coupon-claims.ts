import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vouchers a user saved for later. A claim never reserves a use: usage
 * limits count `coupon_usages` only. Unclaiming soft-deletes the row, so a
 * user holds at most one live claim per voucher. Safe to re-run.
 */
export class CreateCouponClaims1794200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS coupon_claims (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL REFERENCES users(id),
        coupon_id uuid NOT NULL REFERENCES coupons(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_coupon_claims_user_coupon
       ON coupon_claims (user_id, coupon_id) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_coupon_claims_coupon
       ON coupon_claims (coupon_id) WHERE deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS coupon_claims');
  }
}
