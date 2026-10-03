import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HomeStatisticsResponseDto {
  @ApiProperty({
    description:
      'Users with an active enrollment or unexpired digital product access',
  })
  active_students: number;

  @ApiProperty({ description: 'Published classes and bootcamps' })
  learning_products: number;

  @ApiProperty({ description: 'Published digital products' })
  digital_products: number;

  @ApiProperty({
    example: 4.7,
    description: 'Average rating of all reviews, one decimal; 0 without any',
  })
  platform_rating: number;
}

export class HomeMerchantCardResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  slug: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Avatar URL; null without one',
  })
  avatar_url: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "The merchant's most recently published digital product; null without one",
  })
  best_product_title: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Cover URL of that product; null without one',
  })
  best_product_cover_url: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Average rating of that product, one decimal (0 without reviews); null without a product',
  })
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

  @ApiProperty({ description: 'Reviewer name, kept for deleted accounts' })
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
