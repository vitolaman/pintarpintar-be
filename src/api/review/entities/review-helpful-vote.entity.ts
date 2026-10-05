import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// One user's "Membantu" mark on a review; removing the mark deletes the row.
@Entity({ name: 'review_helpful_votes' })
export class ReviewHelpfulVote extends BaseEntity {
  @Column({ name: 'review_id', type: 'uuid' })
  reviewId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;
}
