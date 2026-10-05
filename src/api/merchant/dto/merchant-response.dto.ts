import { MerchantLevelSummaryDto } from '../../merchant-level/dto/merchant-level.dto';
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  MerchantBusinessType,
  merchantBusinessTypes,
  MerchantProductType,
  merchantProductTypes,
} from '../merchant-onboarding';

export class MerchantLandingResponseDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Landing background asset; send it back to keep it',
  })
  background_asset_id: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      'Null without a background or when ASSET_PUBLIC_BASE_URL is unset',
  })
  background_url: string | null;

  @ApiProperty({
    type: [String],
    example: ['best_seller', 'bootcamp', 'kelas', 'digital', 'bundles'],
  })
  section_order: string[];

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: { type: 'string', format: 'uuid' },
    },
    example: { best_seller: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'] },
  })
  item_order: Record<string, string[]>;
}

// The public storefront shows the background but not the editor's asset id.
export class PublicMerchantLandingDto extends OmitType(
  MerchantLandingResponseDto,
  ['background_asset_id'] as const,
) {}

export class MerchantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  store_name: string;

  @ApiPropertyOptional()
  store_description: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty({ enum: ['basic', 'silver', 'gold'] })
  storage_level: string;

  @ApiProperty({ type: MerchantLevelSummaryDto })
  level: MerchantLevelSummaryDto;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  phone: string | null;

  @ApiPropertyOptional()
  tagline: string | null;

  @ApiPropertyOptional()
  category_label: string | null;

  @ApiPropertyOptional()
  city: string | null;

  @ApiPropertyOptional()
  public_email: string | null;

  @ApiPropertyOptional()
  public_phone: string | null;

  @ApiPropertyOptional()
  website_url: string | null;

  @ApiPropertyOptional()
  instagram_handle: string | null;

  @ApiPropertyOptional()
  youtube_url: string | null;

  @ApiPropertyOptional()
  linkedin_url: string | null;

  @ApiPropertyOptional()
  expertise: string | null;

  @ApiPropertyOptional()
  experience_years: number | null;

  @ApiPropertyOptional()
  education: string | null;

  @ApiPropertyOptional()
  portfolio_url: string | null;

  @ApiPropertyOptional()
  refund_policy: string | null;

  @ApiPropertyOptional()
  digital_license: string | null;

  @ApiPropertyOptional({ nullable: true, default: false })
  need_change_password: boolean | null;

  @ApiPropertyOptional()
  terms_accepted_at: Date | null;

  @ApiProperty({
    enum: merchantBusinessTypes,
    nullable: true,
    description:
      'Jenis Merchant from the registration form; null for stores registered before the form asked for it',
  })
  business_type: MerchantBusinessType | null;

  @ApiProperty({
    type: [String],
    enum: merchantProductTypes,
    nullable: true,
    example: ['kelas', 'digital'],
    description:
      'What the merchant intends to sell (Produk yang Ingin Dijual); null for stores registered before the form asked for it',
  })
  product_types: MerchantProductType[] | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Store logo asset; send it back to keep it',
  })
  avatar_asset_id: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Store banner asset; send it back to keep it',
  })
  cover_asset_id: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Null without a logo or when ASSET_PUBLIC_BASE_URL is unset',
  })
  avatar_url: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Null without a banner or when ASSET_PUBLIC_BASE_URL is unset',
  })
  cover_url: string | null;

  @ApiProperty({ type: [String], example: ['AutoCAD', 'SAP2000'] })
  skills: string[];

  @ApiProperty({ type: MerchantLandingResponseDto })
  landing: MerchantLandingResponseDto;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty()
  email_new_sale: boolean;

  @ApiProperty()
  email_new_applicant: boolean;

  @ApiProperty()
  email_new_review: boolean;

  @ApiProperty()
  email_weekly_report: boolean;

  @ApiProperty()
  whatsapp_new_order: boolean;

  @ApiProperty()
  whatsapp_payout_approved: boolean;

  @ApiProperty()
  whatsapp_student_chat: boolean;

  @ApiProperty()
  promotion_broadcast: boolean;
}
