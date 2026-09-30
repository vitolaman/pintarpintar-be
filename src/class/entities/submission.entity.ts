import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Assignment } from './assignment.entity';
import { User } from '../../api/user/entities/user.entity';
import { SubmissionAnswer } from './submission-answer.entity';

@Entity({ name: 'submissions' })
export class Submission extends AuditedBaseEntity {
  @Column({ name: 'assignment_id', type: 'uuid' })
  assignment_id: string;

  @ManyToOne(() => Assignment, (assignment) => assignment.submissions)
  @JoinColumn({ name: 'assignment_id' })
  assignment: Assignment;

  @Column({ name: 'user_id', type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', nullable: true })
  fileName: string;

  @Column({ type: 'varchar', nullable: true })
  fileUrl: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  submissionDate: Date;

  @Column({ type: 'int', nullable: true })
  total_score: number;

  @Column({ name: 'file_asset_id', type: 'uuid', nullable: true })
  file_asset_id: string | null;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @Column({ name: 'is_late', type: 'boolean', default: false })
  is_late: boolean;

  @Column({ name: 'graded_at', type: 'timestamp', nullable: true })
  graded_at: Date | null;

  @Column({ name: 'graded_by', type: 'uuid', nullable: true })
  graded_by: string | null;

  @OneToMany(() => SubmissionAnswer, (answer) => answer.submission)
  answers: SubmissionAnswer[];
}
