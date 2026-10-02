import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { bundleStatuses, BundleStatus } from '../entities/bundle.entity';
import {
  ClearableText,
  EnumInput,
  NumberInput,
  QueryFilter,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { CoverAssetIds } from '~/api/item-cover/cover-asset-ids.decorator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';
import { assetFieldDescription } from '~/api/file-asset/asset-purpose-rules';
import {
  ContentItemType,
  contentItemTypes,
} from '~/common/catalog/catalog-item';

export const bundleItemTypes = ['kelas', 'digital'] as const;

export type BundleItemType = (typeof bundleItemTypes)[number];

export class BundleItemInputDto {
  @EnumInput(contentItemTypes, {
    presence: 'filter',
    description:
      'Optional: resolved from the id. When sent it must name the item family (kelas or bootcamp for a class, digital for a digital product).',
  })
  type?: ContentItemType;

  @ApiProperty({ description: 'Class id or digital product id' })
  @IsUUID()
  id: string;
}

export class CreateBundleDto {
  @RequiredText({ max: 160, example: 'Paket AutoCAD & Template RAB' })
  title: string;

  @RequiredText({
    max: 5000,
    example: 'Kelas AutoCAD lengkap plus template RAB siap pakai.',
  })
  description: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: assetFieldDescription(
      'product_cover',
      'Sets the main cover and keeps the others; null removes the main cover and the next one takes its place.',
    ),
  })
  @IsOptional()
  @IsUUID()
  cover_asset_id?: string | null;

  @CoverAssetIds('product_cover')
  cover_asset_ids?: string[];

  @NumberInput({
    min: 0.01,
    example: 349000,
    description: 'Must be below the items total',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  bundle_price: number;

  @ClearableText({ max: 5000 })
  post_purchase_instructions?: string | null;

  @EnumInput(bundleStatuses, { presence: 'optional', default: 'unpublished' })
  status?: BundleStatus;

  @ApiProperty({ type: [BundleItemInputDto], minItems: 2, maxItems: 20 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BundleItemInputDto)
  items: BundleItemInputDto[];
}

// Null is validated, so it is rejected for fields that cannot be cleared.
export class UpdateBundleDto extends PartialType(CreateBundleDto, {
  skipNullProperties: false,
}) {}

export class BundleListQueryDto {
  @EnumInput(bundleStatuses, {
    presence: 'filter',
    description: 'A blank value means every status',
  })
  status?: BundleStatus;

  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;
}

export class PublicBundleQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "Only this merchant's bundles; a blank value means every merchant",
  })
  @QueryFilter()
  @IsOptional()
  @IsUUID()
  merchant_id?: string;

  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;
}
