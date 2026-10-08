import { Column, Entity } from 'typeorm';

export interface LandingLayout {
  section_order: string[];
  item_order: Record<string, string[]>;
}
import { BaseEntity } from '~/common/entities/base-entity';
import type {
  MerchantBusinessType,
  MerchantProductType,
} from '../merchant-onboarding';

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

  // Registration form answers; null for merchants registered before the form
  // asked for them.
  @Column({
    name: 'business_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  businessType: MerchantBusinessType | null;

  @Column({ name: 'product_types', type: 'text', array: true, nullable: true })
  productTypes: MerchantProductType[] | null;

  // Selling-experience answers of the registration form, stored as sent and
  // shown only to the owner; the form decides which questions apply.
  @Column({ name: 'has_sold_before', type: 'boolean', nullable: true })
  hasSoldBefore: boolean | null;

  @Column({ name: 'product_idea', type: 'text', nullable: true })
  productIdea: string | null;

  @Column({
    name: 'monthly_revenue_range',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  monthlyRevenueRange: string | null;

  @Column({
    name: 'monthly_transaction_range',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  monthlyTransactionRange: string | null;

  @Column({ name: 'sold_products', type: 'text', nullable: true })
  soldProducts: string | null;

  @Column({ name: 'refund_policy', type: 'text', nullable: true })
  refundPolicy: string | null;

  @Column({ name: 'digital_license', type: 'text', nullable: true })
  digitalLicense: string | null;

  @Column({ name: 'landing_background_asset_id', type: 'uuid', nullable: true })
  landingBackgroundAssetId: string | null;

  @Column({ name: 'landing_layout', type: 'jsonb', nullable: true })
  landingLayout: LandingLayout | null;

  @Column({ name: 'need_change_password', nullable: true, default: false })
  needChangePassword: boolean | null;
}
