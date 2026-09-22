import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditedBaseEntity } from '../../common/entities/audited-base.entity';
import { Class } from './class.entity';
import { User } from '../../api/user/entities/user.entity';

export enum CertificateStatus {
  PENDING = 'pending',
  ISSUED = 'issued',
  INELIGIBLE = 'ineligible',
}

@Entity({ name: 'certificates' })
export class Certificate extends AuditedBaseEntity {
  @Column({ name: 'class_id' })
  class_id: string;

  @ManyToOne(() => Class, (cls) => cls.certificates)
  @JoinColumn({ name: 'class_id' })
  class_entity: Class;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', nullable: true })
  certNo: string;

  @Column({ type: 'varchar', default: CertificateStatus.PENDING })
  status: CertificateStatus;

  @Column({ type: 'date', nullable: true })
  issueDate: string;

  @Column({ type: 'varchar', nullable: true })
  fileUrl: string;
}
