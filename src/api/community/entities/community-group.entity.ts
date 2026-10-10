import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';
import { GroupAccess } from '../community.constants';

@Entity({ name: 'community_groups' })
export class CommunityGroup extends BaseEntity {
  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'image_asset_id', type: 'uuid' })
  imageAssetId: string;

  @Column({ type: 'varchar', length: 16 })
  access: GroupAccess;
}
