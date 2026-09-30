import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

/**
 * A purchased item references exactly one catalog item: a digital product or
 * a class (enforced by `chk_order_items_single_reference`).
 */
@Entity({ name: 'order_items' })
export class OrderItem extends BaseEntity {
  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ name: 'price_at_purchase', type: 'numeric' })
  priceAtPurchase: string;
}
