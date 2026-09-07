import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'user_profiles' })
export class Profile extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'avatar_asset_id', type: 'uuid', nullable: true })
  avatarAssetId: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ nullable: true })
  headline: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;
}
