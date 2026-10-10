import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'community_threads' })
export class CommunityThread extends BaseEntity {
  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @Column({ name: 'author_user_id', type: 'uuid' })
  authorUserId: string;

  // Empty when the thread is only an attachment or a promoted item.
  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ name: 'attachment_asset_id', type: 'uuid', nullable: true })
  attachmentAssetId: string | null;

  // The promoted item, at most one of the three.
  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ name: 'bundle_id', type: 'uuid', nullable: true })
  bundleId: string | null;
}
