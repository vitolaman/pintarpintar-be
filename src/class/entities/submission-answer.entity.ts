import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Submission } from './submission.entity';
import { AssignmentQuestion } from './assignment-question.entity';

@Entity({ name: 'submission_answers' })
export class SubmissionAnswer extends AuditedBaseEntity {
  @Column({ name: 'submission_id' })
  submission_id: string;

  @ManyToOne(() => Submission, (submission) => submission.answers)
  @JoinColumn({ name: 'submission_id' })
  submission: Submission;

  @Column({ name: 'question_id' })
  question_id: string;

  @ManyToOne(() => AssignmentQuestion, (question) => question.answers)
  @JoinColumn({ name: 'question_id' })
  question: AssignmentQuestion;

  @Column({ type: 'text', nullable: true })
  user_answer: string;

  @Column({ type: 'boolean', nullable: true })
  is_correct: boolean;

  @Column({ type: 'int', nullable: true })
  score_awarded: number;
}
