import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

export enum ProTransactionStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

// Records a merchant's attempt to subscribe to a Pro plan. Similar to Order,
// it tracks the transaction lifecycle: creation, payment, fulfillment.
@Entity({ name: 'pro_transactions' })
export class ProTransaction extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  // `PRO-YYYYMMDD-NNNN`, dated in Asia/Jakarta; also Duitku's merchant order id.
  @Column({
    name: 'transaction_number',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  transactionNumber: string | null;

  @Column({ name: 'discount_code_id', type: 'uuid', nullable: true })
  discountCodeId: string | null;

  // Snapshot of plan details at purchase time
  @Column({ name: 'plan_name', type: 'varchar', length: 80, nullable: true })
  planName: string | null;

  @Column({ name: 'duration_months', type: 'integer', nullable: true })
  durationMonths: number | null;

  // Amount to pay, after code discounts.
  @Column({ name: 'total_amount', type: 'numeric' })
  totalAmount: string;

  @Column({ name: 'discount_amount', type: 'numeric' })
  discountAmount: string;

  // Constrained to ProTransactionStatus values.
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
}
