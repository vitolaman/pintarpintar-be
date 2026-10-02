import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';

export class CreateReviewDto {
  @ApiPropertyOptional({
    description: 'Class the caller is enrolled in; send this or product_id',
  })
  @ValidateIf((review) => review.product_id === undefined)
  @IsUUID()
  class_id?: string;

  @ApiPropertyOptional({
    description:
      'Digital product the caller has access to; send this or class_id',
  })
  @ValidateIf((review) => review.product_id !== undefined)
  @IsUUID()
  product_id?: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}

export class ReviewListQueryDto {
  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;
}

export class ReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiProperty({ nullable: true })
  comment: string | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ example: 'John Doe' })
  reviewer_name: string;

  @ApiProperty({ nullable: true })
  reviewer_avatar_object_key: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Null when ASSET_PUBLIC_BASE_URL is unset',
  })
  reviewer_avatar_url: string | null;
}

export class ClassReviewSummaryDto {
  @ApiProperty({ example: 4.5 })
  average_rating: number;

  @ApiProperty({ example: 2 })
  review_count: number;

  @ApiProperty({ type: [ReviewResponseDto] })
  reviews: ReviewResponseDto[];
}

export class ReviewedItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['kelas', 'bootcamp', 'digital'] })
  type: 'kelas' | 'bootcamp' | 'digital';

  @ApiProperty({ example: 'Belajar AutoCAD dari Nol' })
  title: string;
}

export class MerchantReviewResponseDto extends ReviewResponseDto {
  @ApiProperty({ type: ReviewedItemDto })
  item: ReviewedItemDto;
}

export class MerchantReviewSummaryDto {
  @ApiProperty({ example: 4.6 })
  average_rating: number;

  @ApiProperty({ example: 12 })
  review_count: number;

  @ApiProperty({ type: [MerchantReviewResponseDto] })
  reviews: MerchantReviewResponseDto[];
}
