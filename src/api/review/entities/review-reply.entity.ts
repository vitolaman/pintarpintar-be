import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

export type ReviewReplyRole = 'merchant' | 'mentor' | 'buyer';

// A reply under a review. The role is the author's relation to the reviewed
// item when they wrote it, and does not change afterwards.
@Entity({ name: 'review_replies' })
export class ReviewReply extends BaseEntity {
  @Column({ name: 'review_id', type: 'uuid' })
  reviewId: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @Column({ name: 'author_role', type: 'varchar', length: 16 })
  authorRole: ReviewReplyRole;

  @Column({ type: 'text' })
  comment: string;
}
