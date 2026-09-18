import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'coupons' })
export class Voucher extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column()
  code: string;

  @Column({ nullable: true })
  name: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  terms: string | null;

  @Column({ name: 'discount_type' })
  discountType: 'percentage' | 'nominal';

  @Column({ name: 'discount_value', type: 'numeric' })
  discountValue: string;

  @Column({ name: 'minimum_order_amount', type: 'numeric', nullable: true })
  minimumOrderAmount: string | null;

  @Column({ name: 'maximum_discount_amount', type: 'numeric', nullable: true })
  maximumDiscountAmount: string | null;

  @Column({ name: 'max_uses', type: 'integer', nullable: true })
  maxUses: number | null;

  @Column({ name: 'starts_at', type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'is_active' })
  isActive: boolean;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null;
}
