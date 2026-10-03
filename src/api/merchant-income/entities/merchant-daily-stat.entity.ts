import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// A merchant's income on one closed Asia/Jakarta day, recomputed from its paid
// sales by MerchantIncomeService. Days without sales or visits have no row.
@Entity({ name: 'merchant_daily_stats' })
export class MerchantDailyStat extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ name: 'stat_date', type: 'date' })
  statDate: string;

  // Net revenue (item price minus the item's discount), IDR.
  @Column({ name: 'daily_revenue', type: 'numeric', default: 0 })
  dailyRevenue: string;

  // Paid orders with at least one of the merchant's items.
  @Column({ name: 'daily_orders', type: 'integer', default: 0 })
  dailyOrders: number;

  // Distinct visitors recorded in merchant_visits.
  @Column({ name: 'daily_product_views', type: 'integer', default: 0 })
  dailyProductViews: number;
}
