import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';
import {
  ClearableText,
  NumberInput,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';
import { ReviewReplyRole } from '../entities/review-reply.entity';

export class CreateReviewDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Class the caller is enrolled in; send this or product_id',
  })
  @ValidateIf((review) => review.product_id === undefined)
  @IsUUID()
  class_id?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Digital product the caller has unexpired access to; send this or class_id',
  })
  @ValidateIf((review) => review.product_id !== undefined)
  @IsUUID()
  product_id?: string;

  @NumberInput({ integer: true, min: 1, max: 5, example: 5 })
  rating: number;

  @ClearableText({ max: 2000 })
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

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Null without an avatar or when ASSET_PUBLIC_BASE_URL is unset',
  })
  reviewer_avatar_url: string | null;
}

export class CreateReviewReplyDto {
  @RequiredText({ max: 2000, example: 'Terima kasih atas ulasannya!' })
  comment: string;
}

export class ReviewReplyDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Terima kasih atas ulasannya!' })
  comment: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ example: 'Pintar Pintar Academy' })
  author_name: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description:
      'Null without an avatar or when ASSET_PUBLIC_BASE_URL is unset',
  })
  author_avatar_url: string | null;

  @ApiProperty({
    enum: ['merchant', 'mentor', 'buyer'],
    description:
      "The author's relation to the reviewed item when they replied: the merchant owner, an assigned class mentor, or a learner/buyer",
  })
  author_role: ReviewReplyRole;
}

export class ReviewHelpfulDto {
  @ApiProperty({ example: 3 })
  helpful_count: number;

  @ApiProperty({ example: true })
  viewer_has_voted: boolean;
}

export class ItemReviewDto extends ReviewResponseDto {
  @ApiProperty({ example: 3, description: 'Users who marked it "Membantu"' })
  helpful_count: number;

  @ApiProperty({
    description: 'Whether the caller marked it; false without a token',
  })
  viewer_has_voted: boolean;

  @ApiProperty({
    description: 'Whether the caller wrote it; false without a token',
  })
  is_own_review: boolean;

  @ApiProperty({ type: [ReviewReplyDto], description: 'Oldest first' })
  replies: ReviewReplyDto[];
}

export class ClassReviewSummaryDto {
  @ApiProperty({ example: 4.5 })
  average_rating: number;

  @ApiProperty({ example: 2 })
  review_count: number;

  @ApiProperty({
    description:
      "Whether the caller may reply to this item's reviews (its learners or buyers, merchant owner and class mentors); false without a token",
  })
  viewer_can_reply: boolean;

  @ApiProperty({ type: [ItemReviewDto] })
  reviews: ItemReviewDto[];
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
