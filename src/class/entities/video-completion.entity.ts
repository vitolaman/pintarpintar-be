import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base-entity';

// A learner finished a video; unique per learner and video.
@Entity({ name: 'video_completions' })
export class VideoCompletion extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @Column({ name: 'video_id', type: 'uuid' })
  video_id: string;

  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @Column({ name: 'completed_at', type: 'timestamp', default: () => 'now()' })
  completed_at: Date;
}
