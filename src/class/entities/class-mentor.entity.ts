import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Class } from './class.entity';
import { PermissionMatrix, TutorRole } from '../class-permissions';
import { Mentor } from '../../api/mentor/entities/mentor.entity';

@Entity({ name: 'class_mentors' })
export class ClassMentor extends AuditedBaseEntity {
  @Column({ name: 'class_id', type: 'uuid' })
  class_id: string;

  @ManyToOne(() => Class, (cls) => cls.class_mentors)
  @JoinColumn({ name: 'class_id' })
  class_entity: Class;

  @Column({ name: 'mentor_id', type: 'uuid' })
  mentor_id: string;

  @ManyToOne(() => Mentor)
  @JoinColumn({ name: 'mentor_id' })
  mentor: Mentor;

  @Column({ type: 'varchar' })
  role: TutorRole;

  @Column({ type: 'jsonb', nullable: true })
  permissions: PermissionMatrix | null;
}
