import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HomeStatisticsResponseDto {
  @ApiProperty()
  active_students: number;

  @ApiProperty()
  learning_products: number;

  @ApiProperty()
  digital_products: number;

  @ApiProperty()
  platform_rating: number;
}

export class HomeMerchantCardResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  slug: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  avatar_asset_id: string | null;

  @ApiPropertyOptional()
  avatar_object_key: string | null;

  @ApiPropertyOptional()
  best_product_title: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  best_product_cover_asset_id: string | null;

  @ApiPropertyOptional()
  best_product_cover_object_key: string | null;

  @ApiPropertyOptional()
  best_product_rating: number | null;
}

export class HomeTestimonialResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  comment: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  user_name: string;

  @ApiPropertyOptional({ format: 'uuid' })
  user_avatar_asset_id: string | null;

  @ApiPropertyOptional()
  user_avatar_object_key: string | null;

  @ApiProperty({ format: 'uuid' })
  class_id: string;

  @ApiProperty()
  class_title: string;
}
