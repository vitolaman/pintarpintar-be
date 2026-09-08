import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'mentor_profiles' })
export class MentorProfile extends BaseEntity {
  @Column({ name: 'mentor_id', type: 'uuid' })
  mentorId: string;

  @Column({ nullable: true })
  expertise: string | null;

  @Column({ name: 'experience_years', type: 'integer', nullable: true })
  experienceYears: number | null;

  @Column({ nullable: true })
  education: string | null;

  @Column({ name: 'portfolio_url', nullable: true })
  portfolioUrl: string | null;

  @Column({ name: 'linkedin_url', nullable: true })
  linkedinUrl: string | null;

  @Column({ name: 'cv_asset_id', type: 'uuid' })
  cvAssetId: string;

  @Column({ name: 'skill_certificate_asset_id', type: 'uuid' })
  skillCertificateAssetId: string;
}
