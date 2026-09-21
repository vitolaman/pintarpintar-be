import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropCouponProductScopes1789948800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS coupon_product_scopes');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE coupon_product_scopes (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
        product_id uuid NOT NULL REFERENCES products(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        deleted_at timestamp
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_coupon_product_scopes_active_pair
      ON coupon_product_scopes (coupon_id, product_id)
      WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX idx_coupon_product_scopes_product_coupon
      ON coupon_product_scopes (product_id, coupon_id)
      WHERE deleted_at IS NULL
    `);
  }
}
