import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';
import { ApplicationStatus } from '../recruitment.constants';

// The applicant's submitted values are kept as given, independent of later
// profile changes.
@Entity({ name: 'job_applications' })
export class JobApplication extends BaseEntity {
  @Column({ name: 'job_posting_id', type: 'uuid' })
  jobPostingId: string;

  @Column({ name: 'applicant_user_id', type: 'uuid' })
  applicantUserId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 32 })
  phone: string;

  @Column({ name: 'linkedin_url', type: 'varchar', length: 500 })
  linkedinUrl: string;

  @Column({ name: 'cv_asset_id', type: 'uuid' })
  cvAssetId: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 20, default: 'review' })
  status: ApplicationStatus;

  @Column({ name: 'interview_at', type: 'timestamptz', nullable: true })
  interviewAt: Date | null;

  @Column({
    name: 'interview_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  interviewUrl: string | null;

  @Column({ name: 'decided_at', type: 'timestamp', nullable: true })
  decidedAt: Date | null;
}
