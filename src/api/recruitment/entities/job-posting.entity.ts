import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';
import { ContractType, JobStatus, WorkType } from '../recruitment.constants';

@Entity({ name: 'job_postings' })
export class JobPosting extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'varchar', length: 64 })
  category: string;

  @Column({ name: 'contract_type', type: 'varchar', length: 20 })
  contractType: ContractType;

  @Column({ name: 'work_type', type: 'varchar', length: 20 })
  workType: WorkType;

  @Column({ type: 'varchar', length: 150, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  salary: string | null;

  @Column({ type: 'text' })
  requirements: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  skills: string[];

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: JobStatus;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt: Date | null;
}
