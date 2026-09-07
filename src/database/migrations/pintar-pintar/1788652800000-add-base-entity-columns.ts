import { MigrationInterface, QueryRunner } from 'typeorm';

type LifecycleColumn = 'created_at' | 'updated_at' | 'deleted_at';

/**
 * Aligns the initial ERD tables with the template BaseEntity contract.
 *
 * The ERD baseline migrations deliberately remain immutable. This additive
 * migration supplies only the BaseEntity lifecycle columns that individual
 * baseline tables did not define; ERD-specific columns such as deleted_by are
 * intentionally unchanged.
 */
export class AddBaseEntityColumns1788652800000 implements MigrationInterface {
  private readonly missingColumns: ReadonlyArray<
    readonly [string, readonly LifecycleColumn[]]
  > = [
    ['categories', ['created_at', 'updated_at']],
    ['product_categories', ['created_at', 'updated_at', 'deleted_at']],
    ['digital_files', ['created_at', 'updated_at', 'deleted_at']],
    ['video_classes', ['created_at', 'updated_at', 'deleted_at']],
    ['videos', ['created_at', 'updated_at']],
    ['bootcamps', ['created_at', 'deleted_at']],
    ['bootcamp_admins', ['created_at', 'updated_at', 'deleted_at']],
    ['bootcamp_comments', ['updated_at']],
    ['bootcamp_meetings', ['created_at', 'updated_at']],
    ['coupons', ['created_at', 'updated_at']],
    ['orders', ['deleted_at']],
    ['order_items', ['created_at', 'updated_at', 'deleted_at']],
    ['coupon_usages', ['created_at', 'updated_at', 'deleted_at']],
    ['user_access', ['created_at', 'updated_at', 'deleted_at']],
    ['reviews', ['updated_at']],
    ['wishlist', ['created_at', 'updated_at', 'deleted_at']],
    ['merchant_payouts', ['created_at', 'deleted_at']],
    ['payout_items', ['created_at', 'updated_at', 'deleted_at']],
    ['product_views', ['created_at', 'updated_at', 'deleted_at']],
    ['merchant_daily_stats', ['created_at', 'updated_at', 'deleted_at']],
    ['student_progress', ['created_at', 'updated_at', 'deleted_at']],
    ['notifications', ['updated_at', 'deleted_at']],
    ['audit_logs', ['updated_at', 'deleted_at']],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, columns] of this.missingColumns) {
      const additions = columns.map((column) => this.columnDefinition(column));

      await queryRunner.query(
        `ALTER TABLE ${table} ${additions.map((addition) => `ADD COLUMN ${addition}`).join(', ')}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, columns] of [...this.missingColumns].reverse()) {
      await queryRunner.query(
        `ALTER TABLE ${table} ${[...columns]
          .reverse()
          .map((column) => `DROP COLUMN ${column}`)
          .join(', ')}`,
      );
    }
  }

  private columnDefinition(column: LifecycleColumn): string {
    if (column === 'deleted_at') {
      return 'deleted_at timestamp';
    }

    return `${column} timestamp NOT NULL DEFAULT now()`;
  }
}
