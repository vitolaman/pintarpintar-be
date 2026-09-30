import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// A discount target: exactly one of a class or a digital product.
@Entity({ name: 'discount_products' })
export class DiscountProduct extends BaseEntity {
  @Column({ name: 'discount_id', type: 'uuid' })
  discountId: string;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;
}
