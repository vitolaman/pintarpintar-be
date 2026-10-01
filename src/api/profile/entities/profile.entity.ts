import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';
import { OnboardingRole } from '../onboarding.constants';

@Entity({ name: 'user_profiles' })
export class Profile extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'avatar_asset_id', type: 'uuid', nullable: true })
  avatarAssetId: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ nullable: true })
  headline: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({
    name: 'onboarding_role',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  onboardingRole: OnboardingRole | null;

  @Column({ name: 'custom_role', type: 'varchar', length: 60, nullable: true })
  customRole: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  skills: string[];

  @Column({
    name: 'onboarding_completed_at',
    type: 'timestamp',
    nullable: true,
  })
  onboardingCompletedAt: Date | null;
}
