import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Class } from './class.entity';
import { AssignmentQuestion } from './assignment-question.entity';
import { Submission } from './submission.entity';

export enum AssignmentType {
  FILE_UPLOAD = 'file_upload',
  QUIZ = 'quiz',
}

@Entity({ name: 'assignments' })
export class Assignment extends AuditedBaseEntity {
  @Column({ name: 'class_id' })
  class_id: string;

  @ManyToOne(() => Class, (cls) => cls.assignments)
  @JoinColumn({ name: 'class_id' })
  class_entity: Class;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp', nullable: true })
  due: Date;

  @Column({ type: 'varchar', default: AssignmentType.FILE_UPLOAD })
  type: AssignmentType;

  @OneToMany(() => AssignmentQuestion, (question) => question.assignment)
  questions: AssignmentQuestion[];

  @OneToMany(() => Submission, (submission) => submission.assignment)
  submissions: Submission[];
}
