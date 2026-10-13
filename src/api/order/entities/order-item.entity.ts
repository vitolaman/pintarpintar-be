import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';
import { PlatformFeePayer } from '~/common/pricing/platform-fee';

/**
 * A purchased item references exactly one catalog item: a digital product, a
 * class, or a bundle (enforced by `chk_order_items_single_reference`).
 */
@Entity({ name: 'order_items' })
export class OrderItem extends BaseEntity {
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ name: 'bundle_id', type: 'uuid', nullable: true })
  bundleId: string | null;

  // Selling price before code discounts.
  @Column({ name: 'price_at_purchase', type: 'numeric' })
  priceAtPurchase: string;

  // This item's share of the order's voucher and discount-code discounts.
  @Column({ name: 'discount_amount', type: 'numeric', default: 0 })
  discountAmount: string;

  // The platform fee on the price after discounts and who pays it, as at
  // checkout; the merchant's income also loses the fee when it pays. Items
  // from before the fee have 0 and no payer.
  @Column({ name: 'platform_fee_amount', type: 'numeric', default: 0 })
  platformFeeAmount: string;

  @Column({
    name: 'platform_fee_paid_by',
    type: 'varchar',
    length: 8,
    nullable: true,
  })
  platformFeePaidBy: PlatformFeePayer | null;
}
