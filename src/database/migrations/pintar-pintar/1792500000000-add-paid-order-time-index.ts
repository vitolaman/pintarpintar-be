import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Paid orders by payment time, so merchant income for recent days starts from
 * the orders paid in that window instead of a store's whole history. Safe to
 * re-run.
 */
export class AddPaidOrderTimeIndex1792500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_orders_paid_at
       ON orders (paid_at) WHERE status = 'paid' AND deleted_at IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_orders_paid_at');
  }
}
