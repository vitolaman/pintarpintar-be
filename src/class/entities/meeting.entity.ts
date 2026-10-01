import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Class } from './class.entity';
import { Attendance } from './attendance.entity';

export enum MeetingStatus {
  UPCOMING = 'upcoming',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'meetings' })
export class Meeting extends AuditedBaseEntity {
  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @ManyToOne(() => Class, (cls) => cls.meetings)
  @JoinColumn({ name: 'class_id' })
  class_entity: Class;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'date', nullable: true })
  date: string;

  @Column({ type: 'time', nullable: true })
  time: string;

  @Column({ type: 'varchar', nullable: true })
  liveUrl: string;

  // Null means the default length used for the derived status (3 hours).
  @Column({ name: 'duration_minutes', type: 'integer', nullable: true })
  duration_minutes: number | null;

  @Column({ name: 'mentor_id', type: 'uuid', nullable: true })
  mentor_id: string | null;

  // Kept for existing rows only; responses derive the status from the start
  // and duration (MEETING_STATUS_SQL).
  @Column({ type: 'varchar', default: MeetingStatus.UPCOMING })
  status: MeetingStatus;

  @OneToMany(() => Attendance, (attendance) => attendance.meeting)
  attendances: Attendance[];
}
