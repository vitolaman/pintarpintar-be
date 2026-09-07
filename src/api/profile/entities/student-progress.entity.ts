import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'student_progress' })
export class StudentProgress extends BaseEntity {
  @Column({ name: 'access_id' })
  accessId: string;

  @Column({ name: 'last_video_id', type: 'uuid', nullable: true })
  lastVideoId: string | null;

  @Column({ name: 'completion_percentage', type: 'numeric' })
  completionPercentage: string;

  @Column({ name: 'total_time_spent', type: 'integer' })
  totalTimeSpent: number;

  @Column({ name: 'last_accessed_at', type: 'timestamp', nullable: true })
  lastAccessedAt: Date | null;
}
