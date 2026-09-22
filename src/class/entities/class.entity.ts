import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Merchant } from '../../api/merchant/entities/merchant.entity';
import { Chapter } from './chapter.entity';
import { Meeting } from './meeting.entity';
import { Assignment } from './assignment.entity';
import { ClassMentor } from './class-mentor.entity';
import { Enrollment } from './enrollment.entity';
import { DiscussionThread } from './discussion-thread.entity';
import { Certificate } from './certificate.entity';

export enum ClassStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum ClassType {
  VIDEO = 'video',
  LIVE_BOOTCAMP = 'live-bootcamp',
}

@Entity({ name: 'classes' })
export class Class extends AuditedBaseEntity {
  @Column({ name: 'merchant_id' })
  merchant_id: string;

  @ManyToOne(() => Merchant, { eager: false })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', default: ClassStatus.DRAFT })
  status: ClassStatus;

  @Column({ type: 'varchar', default: ClassType.VIDEO })
  type: ClassType;

  @Column({ type: 'float', nullable: true })
  originalPrice: number;

  @Column({ type: 'float', nullable: true })
  discountedPrice: number;

  @OneToMany(() => Chapter, (chapter) => chapter.class_entity)
  chapters: Chapter[];

  @OneToMany(() => Meeting, (meeting) => meeting.class_entity)
  meetings: Meeting[];

  @OneToMany(() => Assignment, (assignment) => assignment.class_entity)
  assignments: Assignment[];

  @OneToMany(() => ClassMentor, (mentor) => mentor.class_entity)
  class_mentors: ClassMentor[];

  @OneToMany(() => Enrollment, (enrollment) => enrollment.class_entity)
  enrollments: Enrollment[];

  @OneToMany(() => DiscussionThread, (thread) => thread.class_entity)
  threads: DiscussionThread[];

  @OneToMany(() => Certificate, (certificate) => certificate.class_entity)
  certificates: Certificate[];
}
