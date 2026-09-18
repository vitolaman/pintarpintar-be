import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'coupon_product_scopes' })
export class CouponProductScope extends BaseEntity {
  @Column({ name: 'coupon_id', type: 'uuid' })
  couponId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;
}
