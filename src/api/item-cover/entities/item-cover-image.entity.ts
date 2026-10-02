import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// One ordered cover of a class, digital product or bundle (exactly one owner).
// Position 0 is the main cover, mirrored in the item's cover_asset_id.
@Entity({ name: 'item_cover_images' })
export class ItemCoverImage extends BaseEntity {
  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ name: 'bundle_id', type: 'uuid', nullable: true })
  bundleId: string | null;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @Column({ type: 'smallint' })
  position: number;
}
