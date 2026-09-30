import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// One cart line (quantity 1): exactly one of a class, digital product, or bundle.
@Entity({ name: 'cart_items' })
export class CartItem extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ name: 'bundle_id', type: 'uuid', nullable: true })
  bundleId: string | null;

  @Column({ name: 'added_at', type: 'timestamp', default: () => 'now()' })
  addedAt: Date;
}
