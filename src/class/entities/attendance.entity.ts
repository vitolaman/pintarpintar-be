import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Meeting } from './meeting.entity';
import { User } from '../../api/user/entities/user.entity';

export enum AttendanceStatus {
  HADIR = 'hadir',
  IZIN = 'izin',
  ALPA = 'alpa',
}

@Entity({ name: 'attendances' })
export class Attendance extends AuditedBaseEntity {
  @Column({ name: 'meeting_id' })
  meeting_id: string;

  @ManyToOne(() => Meeting, (meeting) => meeting.attendances)
  @JoinColumn({ name: 'meeting_id' })
  meeting: Meeting;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', default: AttendanceStatus.HADIR })
  status: AttendanceStatus;

  @Column({ type: 'time', nullable: true })
  checkInTime: string;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
