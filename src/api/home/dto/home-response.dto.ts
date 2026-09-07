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

export class HomeProductCardResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  product_type: string;

  @ApiPropertyOptional()
  level: string | null;

  @ApiProperty()
  price: number;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional()
  original_price: number | null;

  @ApiPropertyOptional({ format: 'uuid' })
  cover_asset_id: string | null;

  @ApiPropertyOptional()
  cover_object_key: string | null;

  @ApiProperty({ type: [String] })
  categories: string[];

  @ApiProperty()
  rating: number;

  @ApiProperty()
  review_count: number;

  @ApiProperty({ format: 'uuid' })
  merchant_id: string;

  @ApiProperty()
  merchant_name: string;

  @ApiPropertyOptional()
  merchant_slug: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  merchant_avatar_asset_id: string | null;

  @ApiPropertyOptional()
  merchant_avatar_object_key: string | null;
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

export class HomeResponseDto {
  @ApiProperty({ type: HomeStatisticsResponseDto })
  statistics: HomeStatisticsResponseDto;

  @ApiProperty({ type: [HomeProductCardResponseDto] })
  featured_bootcamps: HomeProductCardResponseDto[];

  @ApiProperty({ type: [HomeProductCardResponseDto] })
  featured_video_classes: HomeProductCardResponseDto[];

  @ApiProperty({ type: [HomeProductCardResponseDto] })
  featured_digital_products: HomeProductCardResponseDto[];

  @ApiProperty({ type: [HomeMerchantCardResponseDto] })
  latest_merchants: HomeMerchantCardResponseDto[];
}
