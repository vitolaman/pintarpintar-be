import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

/**
 * A voucher reserved by an order. Released usages are soft-deleted, and a
 * voucher's usage limit counts only active rows.
 */
@Entity({ name: 'coupon_usages' })
export class CouponUsage extends BaseEntity {
  @Column({ name: 'coupon_id', type: 'uuid' })
  couponId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'used_at', type: 'timestamp', default: () => 'now()' })
  usedAt: Date;
}
