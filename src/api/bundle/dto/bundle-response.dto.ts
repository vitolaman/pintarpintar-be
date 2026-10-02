import { ItemCoverDto } from '../../item-cover/dto/item-cover.dto';
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { bundleStatuses, BundleStatus } from '../entities/bundle.entity';
import { bundleItemTypes, BundleItemType } from './bundle-request.dto';

export class BundleItemResponseDto {
  @ApiProperty({ description: 'Class id or digital product id' })
  id: string;

  @ApiProperty({ enum: bundleItemTypes })
  type: BundleItemType;

  @ApiProperty({ enum: ['video', 'live-bootcamp'], nullable: true })
  class_type: string | null;

  @ApiProperty({ example: 'Belajar AutoCAD dari Nol' })
  title: string;

  @ApiProperty({ example: 299000, description: 'Current selling price' })
  price: number;

  @ApiProperty({ nullable: true, description: 'Cover object key' })
  image: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'Public cover URL; null without a cover or ASSET_PUBLIC_BASE_URL',
  })
  image_url: string | null;

  @ApiProperty({ description: 'Public availability, required for publishing' })
  is_available: boolean;
}

export class BundleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ nullable: true })
  cover_asset_id: string | null;

  @ApiProperty({ nullable: true })
  cover_object_key: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'Public cover URL; null without a cover or ASSET_PUBLIC_BASE_URL',
  })
  cover_url: string | null;

  @ApiProperty({
    type: [ItemCoverDto],
    description: 'Ordered covers; the first equals cover_asset_id',
  })
  covers: ItemCoverDto[];

  @ApiProperty({ type: [BundleItemResponseDto] })
  items: BundleItemResponseDto[];

  @ApiProperty({
    example: 424000,
    description: 'Harga coret: sum of item prices',
  })
  original_total: number;

  @ApiProperty({ example: 349000 })
  bundle_price: number;

  @ApiProperty({ example: 75000 })
  saving_amount: number;

  @ApiProperty({ example: 18 })
  saving_percent: number;

  @ApiProperty({ example: 14, description: 'Items of paid orders' })
  sales_count: number;

  @ApiProperty({ enum: bundleStatuses })
  status: BundleStatus;

  @ApiProperty({ nullable: true })
  post_purchase_instructions: string | null;

  @ApiProperty()
  created_at: Date;
}

export class PublicBundleMerchantDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  slug: string | null;
}

// Public view of a published bundle; post-purchase instructions stay private.
export class PublicBundleResponseDto extends OmitType(BundleResponseDto, [
  'post_purchase_instructions',
  'status',
] as const) {
  @ApiProperty({ type: PublicBundleMerchantDto })
  merchant: PublicBundleMerchantDto;
}
