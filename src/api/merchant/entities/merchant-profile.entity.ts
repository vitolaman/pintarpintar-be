import { Column, Entity } from 'typeorm';
import { BaseEntity } from '~/common/entities/base-entity';

@Entity({ name: 'merchant_profiles' })
export class MerchantProfile extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column()
  slug: string;

  @Column({ name: 'avatar_asset_id', type: 'uuid', nullable: true })
  avatarAssetId: string | null;

  @Column({ name: 'cover_asset_id', type: 'uuid', nullable: true })
  coverAssetId: string | null;

  @Column({ nullable: true })
  tagline: string | null;

  @Column({ name: 'category_label', nullable: true })
  categoryLabel: string | null;

  @Column({ nullable: true })
  city: string | null;

  @Column({ name: 'public_email', nullable: true })
  publicEmail: string | null;

  @Column({ name: 'public_phone', nullable: true })
  publicPhone: string | null;

  @Column({ name: 'website_url', nullable: true })
  websiteUrl: string | null;

  @Column({ name: 'instagram_handle', nullable: true })
  instagramHandle: string | null;

  @Column({ name: 'youtube_url', nullable: true })
  youtubeUrl: string | null;

  @Column({ name: 'linkedin_url', nullable: true })
  linkedinUrl: string | null;

  @Column({ nullable: true })
  expertise: string | null;

  @Column({ name: 'experience_years', type: 'integer', nullable: true })
  experienceYears: number | null;

  @Column({ nullable: true })
  education: string | null;

  @Column({ name: 'portfolio_url', nullable: true })
  portfolioUrl: string | null;

  @Column({ name: 'cv_asset_id', type: 'uuid', nullable: true })
  cvAssetId: string | null;

  @Column({ name: 'certificate_asset_id', type: 'uuid', nullable: true })
  certificateAssetId: string | null;

  @Column({ name: 'terms_accepted_at', type: 'timestamp', nullable: true })
  termsAcceptedAt: Date | null;

  @Column({ name: 'refund_policy', type: 'text', nullable: true })
  refundPolicy: string | null;

  @Column({ name: 'digital_license', type: 'text', nullable: true })
  digitalLicense: string | null;
}
