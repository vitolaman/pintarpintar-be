import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

export const discountTypes = ['percentage', 'nominal'] as const;

export type DiscountType = (typeof discountTypes)[number];

@Entity({ name: 'discounts' })
export class Discount extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'discount_type', type: 'varchar' })
  discountType: DiscountType;

  @Column({ name: 'discount_value', type: 'numeric' })
  discountValue: string;

  @Column({ name: 'minimum_purchase', type: 'numeric', nullable: true })
  minimumPurchase: string | null;

  @Column({ name: 'starts_at', type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
