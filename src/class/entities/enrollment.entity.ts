import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Class } from './class.entity';
import { User } from '../../api/user/entities/user.entity';

@Entity({ name: 'enrollments' })
export class Enrollment extends AuditedBaseEntity {
  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'class_id' })
  class_id: string;

  @ManyToOne(() => Class, (cls) => cls.enrollments)
  @JoinColumn({ name: 'class_id' })
  class_entity: Class;

  @Column({ type: 'date', nullable: true })
  joinDate: string;

  @Column({ type: 'varchar', nullable: true })
  progress: string;
}
