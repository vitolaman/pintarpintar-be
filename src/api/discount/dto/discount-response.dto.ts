import { ApiProperty } from '@nestjs/swagger';
import { discountCodeTypes } from '../entities/discount-code.entity';
import { discountTypes } from '../entities/discount.entity';
import {
  ContentItemType,
  contentItemTypes,
} from '~/common/catalog/catalog-item';

export const discountStatuses = [
  'inactive',
  'scheduled',
  'active',
  'expired',
  'limit_reached',
] as const;

export type DiscountStatus = (typeof discountStatuses)[number];

export class DiscountTargetResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    enum: contentItemTypes,
    description: 'kelas or bootcamp for a class, digital for a digital product',
  })
  type: ContentItemType;

  @ApiProperty({ example: 'Belajar AutoCAD dari Nol' })
  title: string;
}

export class DiscountEligibleItemResponseDto extends DiscountTargetResponseDto {
  @ApiProperty({ example: 299000, description: 'Current selling price' })
  price: number;

  @ApiProperty({
    nullable: true,
    description:
      'Public cover URL; null without a cover or ASSET_PUBLIC_BASE_URL',
  })
  image_url: string | null;

  @ApiProperty({
    description: 'Published (classes: published or archived)',
  })
  is_available: boolean;
}

export class DiscountCodeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'DSC-7KQ2MX9P' })
  code: string;

  @ApiProperty({ enum: discountCodeTypes })
  code_type: string;

  @ApiProperty({ example: 100 })
  usage_limit: number;

  @ApiProperty({ example: 0 })
  used_count: number;
}

export class DiscountResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: discountTypes })
  discount_type: string;

  @ApiProperty({ example: 20 })
  discount_value: number;

  @ApiProperty({ nullable: true, example: 100000 })
  minimum_purchase: number | null;

  @ApiProperty({ nullable: true })
  starts_at: Date | null;

  @ApiProperty({ nullable: true })
  ends_at: Date | null;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty({
    enum: discountStatuses,
    description:
      'inactive: switched off; scheduled: starts later; expired: ended; limit_reached: every code is used up (used_count >= usage_limit); active: usable',
  })
  status: DiscountStatus;

  @ApiProperty({
    description: 'True when the discount has no explicit targets',
  })
  applies_to_all: boolean;

  @ApiProperty({ type: [DiscountTargetResponseDto] })
  targets: DiscountTargetResponseDto[];

  @ApiProperty({ type: [DiscountCodeResponseDto] })
  codes: DiscountCodeResponseDto[];

  @ApiProperty({ example: 600, description: 'Sum of code usage limits' })
  total_quota: number;

  @ApiProperty()
  created_at: Date;
}
