import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// A Pro plan the platform team can offer. Prices and durations live here, so
// a new plan is a row, not a code change.
@Entity({ name: 'pro_plans' })
export class ProPlan extends BaseEntity {
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'duration_months', type: 'integer' })
  durationMonths: number;

  @Column({ type: 'numeric' })
  price: string;

  @Column({ name: 'is_offered', type: 'boolean', default: false })
  isOffered: boolean;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder: number;
}
