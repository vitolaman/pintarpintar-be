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
  @Column({ name: 'class_id' })
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

  @Column({ type: 'varchar', default: MeetingStatus.UPCOMING })
  status: MeetingStatus;

  @OneToMany(() => Attendance, (attendance) => attendance.meeting)
  attendances: Attendance[];
}
