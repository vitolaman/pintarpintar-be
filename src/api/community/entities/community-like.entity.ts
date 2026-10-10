import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// A like of exactly one thread or one reply.
@Entity({ name: 'community_likes' })
export class CommunityLike extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'thread_id', type: 'uuid', nullable: true })
  threadId: string | null;

  @Column({ name: 'reply_id', type: 'uuid', nullable: true })
  replyId: string | null;
}
