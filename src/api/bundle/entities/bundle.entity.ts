import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

export const bundleStatuses = ['published', 'unpublished', 'unlisted'] as const;

export type BundleStatus = (typeof bundleStatuses)[number];

@Entity({ name: 'bundles' })
export class Bundle extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'cover_asset_id', type: 'uuid', nullable: true })
  coverAssetId: string | null;

  // Merchant-set sale price; the strikethrough total is derived from items.
  @Column({ name: 'bundle_price', type: 'numeric' })
  bundlePrice: string;

  @Column({ name: 'post_purchase_instructions', type: 'text', nullable: true })
  postPurchaseInstructions: string | null;

  @Column({ type: 'varchar', default: 'published' })
  status: BundleStatus;
}
