import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'community_replies' })
export class CommunityReply extends BaseEntity {
  @Column({ name: 'thread_id', type: 'uuid' })
  threadId: string;

  @Column({ name: 'author_user_id', type: 'uuid' })
  authorUserId: string;

  @Column({ type: 'text' })
  content: string;
}
