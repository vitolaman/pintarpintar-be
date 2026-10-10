import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';
import { MemberRole, MemberStatus } from '../community.constants';

// A `pending` row is a join request; it becomes `active` when accepted.
@Entity({ name: 'community_group_members' })
export class CommunityGroupMember extends BaseEntity {
  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  role: MemberRole;

  @Column({ type: 'varchar', length: 16 })
  status: MemberStatus;
}
