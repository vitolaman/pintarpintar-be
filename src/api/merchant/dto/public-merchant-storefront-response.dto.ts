import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicMerchantLandingDto } from './merchant-response.dto';

export class PublicMerchantStorefrontResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  store_name: string;

  @ApiPropertyOptional()
  store_description: string | null;

  @ApiProperty()
  slug: string;

  @ApiPropertyOptional()
  tagline: string | null;

  @ApiPropertyOptional()
  category_label: string | null;

  @ApiPropertyOptional({
    example: 'teknik-arsitektur',
    description: 'Slug derived from the merchant category label.',
  })
  category_slug: string | null;

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

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  total_students: number;

  @ApiProperty()
  published_class_count: number;

  @ApiProperty()
  published_digital_product_count: number;

  @ApiPropertyOptional()
  average_rating: number;

  @ApiProperty()
  review_count: number;

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

  @ApiProperty({
    type: [String],
    example: ['AutoCAD', 'SAP2000'],
    description: 'Bidang',
  })
  skills: string[];

  @ApiProperty({ type: PublicMerchantLandingDto })
  landing: PublicMerchantLandingDto;

  @ApiProperty({
    description: 'True only when the signed-in caller owns this merchant',
  })
  is_owner: boolean;
}
