import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

export type ProPeriodSource = 'payment' | 'manual';
export type ProPeriodStatus = 'active' | 'cancelled';

// One stretch of Pro time for a merchant. It copies the plan's name, duration
// and price when it is created, so a later plan change does not alter it; a
// manual grant by the platform team may have no plan.
@Entity({ name: 'merchant_pro_periods' })
export class MerchantProPeriod extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  @Column({ name: 'plan_name', type: 'varchar', length: 80, nullable: true })
  planName: string | null;

  @Column({ name: 'duration_months', type: 'integer', nullable: true })
  durationMonths: number | null;

  @Column({ type: 'numeric', nullable: true })
  price: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @Column({ type: 'varchar', length: 16 })
  source: ProPeriodSource;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: ProPeriodStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;
}
