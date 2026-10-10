import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

/**
 * A voucher a user saved to see at checkout. It does not reserve a use;
 * unclaiming soft-deletes the row.
 */
@Entity({ name: 'coupon_claims' })
export class CouponClaim extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'coupon_id', type: 'uuid' })
  couponId: string;
}
