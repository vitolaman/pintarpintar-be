import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
}

@Entity({ name: 'orders' })
export class Order extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'coupon_id', type: 'uuid', nullable: true })
  couponId: string | null;

  @Column({ name: 'total_amount', type: 'numeric' })
  totalAmount: string;

  @Column({ name: 'discount_amount', type: 'numeric' })
  discountAmount: string;

  // Free text in the shared schema; `pending` and `paid` are the values in use.
  @Column({ type: 'varchar' })
  status: string;

  @Column({ name: 'payment_gateway_ref', type: 'varchar', nullable: true })
  paymentGatewayRef: string | null;
}
