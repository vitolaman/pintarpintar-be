import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Assignment } from './assignment.entity';
import { SubmissionAnswer } from './submission-answer.entity';

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  ESSAY = 'essay',
}

@Entity({ name: 'assignment_questions' })
export class AssignmentQuestion extends AuditedBaseEntity {
  @Column({ name: 'assignment_id' })
  assignment_id: string;

  @ManyToOne(() => Assignment, (assignment) => assignment.questions)
  @JoinColumn({ name: 'assignment_id' })
  assignment: Assignment;

  @Column({ type: 'text' })
  question_text: string;

  @Column({ type: 'varchar', default: QuestionType.ESSAY })
  type: QuestionType;

  @Column({ type: 'jsonb', nullable: true })
  options: any;

  @Column({ type: 'varchar', nullable: true })
  correct_answer: string;

  @Column({ type: 'int', default: 0 })
  score_weight: number;

  @OneToMany(() => SubmissionAnswer, (answer) => answer.question)
  answers: SubmissionAnswer[];
}
