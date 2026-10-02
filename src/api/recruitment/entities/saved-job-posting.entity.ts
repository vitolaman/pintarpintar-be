import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

// A job posting a user saved on the job board ("Lowongan Tersimpan").
@Entity({ name: 'saved_job_postings' })
export class SavedJobPosting extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'job_posting_id', type: 'uuid' })
  jobPostingId: string;
}
