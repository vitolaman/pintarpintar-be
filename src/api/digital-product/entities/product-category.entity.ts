import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'product_categories' })
export class ProductCategory extends BaseEntity {
  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;
}
