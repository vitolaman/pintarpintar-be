import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { bundleStatuses, BundleStatus } from '../entities/bundle.entity';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';
import { CoverAssetIds } from '~/api/item-cover/cover-asset-ids.decorator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';
import { assetFieldDescription } from '~/api/file-asset/asset-purpose-rules';

export const bundleItemTypes = ['kelas', 'digital'] as const;

export type BundleItemType = (typeof bundleItemTypes)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class BundleItemInputDto {
  @ApiProperty({
    enum: bundleItemTypes,
    description: 'kelas = class, digital = digital product',
  })
  @IsIn(bundleItemTypes)
  type: BundleItemType;

  @ApiProperty({ description: 'Class id or digital product id' })
  @IsUUID()
  id: string;
}

export class CreateBundleDto {
  @ApiProperty({ example: 'Paket AutoCAD & Template RAB', maxLength: 160 })
  @Transform(trim)
  @IsString()
  @Length(1, 160)
  title: string;

  @ApiProperty({
    example: 'Kelas AutoCAD lengkap plus template RAB siap pakai.',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 5000)
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

  @ApiProperty({
    example: 349000,
    description: 'Must be below the items total',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  bundle_price: number;

  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  post_purchase_instructions?: string | null;

  @ApiPropertyOptional({ enum: bundleStatuses, default: 'published' })
  @OptionalNotNull()
  @IsIn(bundleStatuses)
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
  @ApiPropertyOptional({ enum: bundleStatuses })
  @IsOptional()
  @IsIn(bundleStatuses)
  status?: BundleStatus;

  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;
}

export class PublicBundleQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: "Only this merchant's bundles",
  })
  @IsOptional()
  @IsUUID()
  merchant_id?: string;

  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;
}
