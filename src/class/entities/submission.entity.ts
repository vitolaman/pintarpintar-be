import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Assignment } from './assignment.entity';
import { User } from '../../api/user/entities/user.entity';
import { SubmissionAnswer } from './submission-answer.entity';

@Entity({ name: 'submissions' })
export class Submission extends AuditedBaseEntity {
  @Column({ name: 'assignment_id' })
  assignment_id: string;

  @ManyToOne(() => Assignment, (assignment) => assignment.submissions)
  @JoinColumn({ name: 'assignment_id' })
  assignment: Assignment;

  @Column({ name: 'user_id' })
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

  @OneToMany(() => SubmissionAnswer, (answer) => answer.submission)
  answers: SubmissionAnswer[];
}
