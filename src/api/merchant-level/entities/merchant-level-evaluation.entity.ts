import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';
import { MerchantStorageLevel } from '~/api/merchant/entities/merchant.entity';

export type InactivityAction = 'none' | 'warning' | 'removed';

// One row per merchant and evaluated calendar month (Asia/Jakarta). The
// history, the outstanding warning and the last removal derive from it.
@Entity({ name: 'merchant_level_evaluations' })
export class MerchantLevelEvaluation extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  // First day of the evaluated month.
  @Column({ name: 'period_month', type: 'date' })
  periodMonth: string;

  @Column({ type: 'numeric' })
  revenue: string;

  @Column({ name: 'previous_month_revenue', type: 'numeric' })
  previousMonthRevenue: string;

  @Column({
    name: 'previous_level',
    type: 'enum',
    enum: MerchantStorageLevel,
    enumName: 'merchant_storage_level_enum',
  })
  previousLevel: MerchantStorageLevel;

  @Column({
    name: 'new_level',
    type: 'enum',
    enum: MerchantStorageLevel,
    enumName: 'merchant_storage_level_enum',
  })
  newLevel: MerchantStorageLevel;

  @Column({ name: 'inactivity_action', type: 'varchar', length: 16 })
  inactivityAction: InactivityAction;

  @Column({ name: 'removed_items', type: 'int' })
  removedItems: number;
}
