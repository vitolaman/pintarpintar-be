import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ format: 'uuid' })
  avatar_asset_id: string | null;

  @ApiPropertyOptional()
  avatar_object_key: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  cover_asset_id: string | null;

  @ApiPropertyOptional()
  cover_object_key: string | null;

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
}
