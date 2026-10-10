import { ApiProperty } from '@nestjs/swagger';
import { ClearableText, NumberInput } from '~/common/decorator/input.decorator';

export class SavePlatformReviewDto {
  @NumberInput({ integer: true, min: 1, max: 5, example: 5 })
  rating: number;

  @ClearableText({ max: 2000, example: 'Mudah dipakai untuk jualan kelas' })
  comment?: string | null;
}

export class PlatformReviewResponseDto {
  @ApiProperty({ example: 5 })
  rating: number;

  @ApiProperty({ nullable: true })
  comment: string | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class PlatformReviewStoreDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  slug: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Null without a logo or when ASSET_PUBLIC_BASE_URL is unset',
  })
  logo_url: string | null;
}

export class PublicPlatformReviewDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiProperty({ nullable: true })
  comment: string | null;

  @ApiProperty({ description: 'When the review was last saved' })
  updated_at: Date;

  @ApiProperty({ type: PlatformReviewStoreDto })
  store: PlatformReviewStoreDto;
}

export class PlatformReviewListDto {
  @ApiProperty({ example: 4.5, description: 'One decimal; 0 without reviews' })
  average_rating: number;

  @ApiProperty({ example: 2 })
  review_count: number;

  @ApiProperty({ type: [PublicPlatformReviewDto], description: 'Newest first' })
  reviews: PublicPlatformReviewDto[];
}
