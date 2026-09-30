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
import {
  ClassCategory,
  LearningLevel,
} from '../../common/catalog/class-details';

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
  @Column({ name: 'merchant_id', type: 'uuid' })
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

  @Column({ name: 'cover_asset_id', type: 'uuid', nullable: true })
  cover_asset_id: string | null;

  @Column({ name: 'post_purchase_instructions', type: 'text', nullable: true })
  post_purchase_instructions: string | null;

  // Bidang; constrained by `chk_classes_category` to `classCategories`.
  @Column({ type: 'varchar', length: 20, nullable: true })
  category: ClassCategory | null;

  // Constrained by `chk_classes_level` to `learningLevels`.
  @Column({ type: 'varchar', length: 20, nullable: true })
  level: LearningLevel | null;

  // Free text such as "8 minggu" or "20 jam".
  @Column({ type: 'varchar', length: 60, nullable: true })
  duration: string | null;

  @Column({ type: 'text', nullable: true })
  prerequisites: string | null;

  @Column({ name: 'learning_outcomes', type: 'jsonb', nullable: true })
  learning_outcomes: string[] | null;

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
