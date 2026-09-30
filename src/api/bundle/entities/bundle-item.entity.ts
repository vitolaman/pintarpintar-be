import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

/**
 * One included item: exactly one of a class or a digital product
 * (enforced by `chk_bundle_items_single_reference`).
 */
@Entity({ name: 'bundle_items' })
export class BundleItem extends BaseEntity {
  @Column({ name: 'bundle_id', type: 'uuid' })
  bundleId: string;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ name: 'display_order', type: 'integer' })
  displayOrder: number;
}
