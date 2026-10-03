import { ItemCoverDto } from '../../item-cover/dto/item-cover.dto';
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { bundleStatuses, BundleStatus } from '../entities/bundle.entity';
import {
  ContentItemType,
  contentItemTypes,
} from '~/common/catalog/catalog-item';

export class BundleItemResponseDto {
  @ApiProperty({ description: 'Class id or digital product id' })
  id: string;

  @ApiProperty({ enum: contentItemTypes })
  type: ContentItemType;

  @ApiProperty({ example: 'Belajar AutoCAD dari Nol' })
  title: string;

  @ApiProperty({ example: 299000, description: 'Current selling price' })
  price: number;

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

  @ApiProperty({
    nullable: true,
    description: 'Main cover asset id, sent back when editing',
  })
  cover_asset_id: string | null;

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
  original_price: number;

  @ApiProperty({ example: 349000, description: 'Bundle selling price' })
  price: number;

  @ApiProperty({ example: 75000, description: 'original_price minus price' })
  discount_amount: number;

  @ApiProperty({
    example: 18,
    description: 'discount_amount as a rounded percent of original_price',
  })
  discount_percent: number;

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

// Public view of a published bundle; post-purchase instructions stay private,
// and the cover asset id is only needed by the merchant editor.
export class PublicBundleResponseDto extends OmitType(BundleResponseDto, [
  'cover_asset_id',
  'post_purchase_instructions',
  'status',
] as const) {
  @ApiProperty({ type: PublicBundleMerchantDto })
  merchant: PublicBundleMerchantDto;
}
