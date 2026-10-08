import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'products' })
export class Product extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'discount_price', type: 'numeric' })
  discountPrice: string;

  @Column()
  currency: string;

  @Column({ name: 'product_type' })
  productType: string;

  @Column({ name: 'is_published' })
  isPublished: boolean;

  @Column({ name: 'publication_status' })
  publicationStatus: string;

  @Column({ name: 'cover_asset_id', type: 'uuid', nullable: true })
  coverAssetId: string | null;

  @Column({ name: 'post_purchase_instructions', type: 'text', nullable: true })
  postPurchaseInstructions: string | null;

  @Column({ nullable: true })
  level: string | null;

  // Kategori Skill: the label of the form's selector, as on classes.
  @Column({
    name: 'skill_category',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  skillCategory: string | null;

  @Column({ name: 'original_price', type: 'numeric', nullable: true })
  originalPrice: string | null;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;
}
