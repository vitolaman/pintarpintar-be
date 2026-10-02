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

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Avatar URL; null without one',
  })
  avatar_url: string | null;

  @ApiPropertyOptional()
  best_product_title: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Best product cover URL; null without one',
  })
  best_product_cover_url: string | null;

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

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Reviewer avatar URL; null without one',
  })
  user_avatar_url: string | null;

  @ApiProperty({ format: 'uuid' })
  class_id: string;

  @ApiProperty()
  class_title: string;
}
