import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  EXPIRED = 'expired',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'orders' })
export class Order extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // `ORD-YYYYMMDD-NNNN`, dated in Asia/Jakarta; also Duitku's merchant order id.
  @Column({ name: 'order_number', type: 'varchar', length: 20, nullable: true })
  orderNumber: string | null;

  @Column({ name: 'coupon_id', type: 'uuid', nullable: true })
  couponId: string | null;

  @Column({ name: 'discount_code_id', type: 'uuid', nullable: true })
  discountCodeId: string | null;

  // The amount to pay, after code discounts.
  @Column({ name: 'total_amount', type: 'numeric' })
  totalAmount: string;

  @Column({ name: 'discount_amount', type: 'numeric' })
  discountAmount: string;

  // Constrained by `chk_orders_status` to the `OrderStatus` values.
  @Column({ type: 'varchar' })
  status: string;

  // Duitku's invoice reference.
  @Column({ name: 'payment_gateway_ref', type: 'varchar', nullable: true })
  paymentGatewayRef: string | null;

  @Column({ name: 'payment_url', type: 'text', nullable: true })
  paymentUrl: string | null;

  // Duitku payment channel code reported on payment, e.g. `BC` or `SP`.
  @Column({
    name: 'payment_method',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  paymentMethod: string | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  // Asia/Jakarta date on which merchant income becomes withdrawable.
  @Column({ name: 'settlement_date', type: 'date', nullable: true })
  settlementDate: string | null;

  @Column({ name: 'settled_at', type: 'timestamp', nullable: true })
  settledAt: Date | null;
}
