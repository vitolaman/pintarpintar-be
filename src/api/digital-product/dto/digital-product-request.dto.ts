import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CoverAssetIds } from '~/api/item-cover/cover-asset-ids.decorator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';
import { assetFieldDescription } from '~/api/file-asset/asset-purpose-rules';

export const productStatuses = [
  'published',
  'unpublished',
  'unlisted',
] as const;

export type ProductStatus = (typeof productStatuses)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const CATEGORY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateDigitalProductDto {
  @ApiProperty({ example: 'Template RAB Excel Proyek Rumah', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @Length(1, 255)
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(10000)
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'excel',
    description:
      'Category slug: pdf, template, e-book, project-files, template-canva, excel, desain-grafis, videografi, lainnya',
  })
  @Matches(CATEGORY_SLUG, { message: 'category_slug must be a category slug' })
  category_slug: string;

  @ApiProperty({
    example: 150000,
    minimum: 0,
    description: 'List price (Harga Asli)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  original_price: number;

  @ApiPropertyOptional({
    example: 99000,
    minimum: 0,
    description:
      'Selling price when greater than 0; must not exceed original_price',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  discount_price?: number;

  @ApiProperty({ enum: productStatuses, example: 'unpublished' })
  @IsIn(productStatuses)
  status: ProductStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    description: assetFieldDescription('product_cover', 'The main cover.'),
  })
  @IsUUID()
  @IsOptional()
  cover_asset_id?: string;

  @CoverAssetIds('product_cover')
  cover_asset_ids?: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    description: assetFieldDescription('digital_file', 'Required to publish.'),
  })
  @IsUUID()
  @IsOptional()
  file_asset_id?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  post_purchase_instructions?: string;
}

// Omitted fields stay unchanged; null clears a nullable field.
export class UpdateDigitalProductDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @Transform(trim)
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(1, 255)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(10000)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ example: 'excel' })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(CATEGORY_SLUG, { message: 'category_slug must be a category slug' })
  category_slug?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @ValidateIf((_, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  original_price?: number;

  @ApiPropertyOptional({
    minimum: 0,
    nullable: true,
    description: 'Null or 0 removes the discount',
  })
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  discount_price?: number | null;

  @ApiPropertyOptional({ enum: productStatuses })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(productStatuses)
  status?: ProductStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: assetFieldDescription(
      'product_cover',
      'Sets the main cover and keeps the others; null removes the main cover and the next one takes its place.',
    ),
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  @IsOptional()
  cover_asset_id?: string | null;

  @CoverAssetIds('product_cover')
  cover_asset_ids?: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    description: assetFieldDescription(
      'digital_file',
      "Replaces the product's single file.",
    ),
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  file_asset_id?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  post_purchase_instructions?: string | null;
}

export class DigitalProductListQueryDto {
  @PageQuery()
  page?: number = 1;

  @LimitQuery()
  limit?: number = 10;

  @ApiPropertyOptional({ enum: productStatuses })
  @IsIn(productStatuses)
  @IsOptional()
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Matches the title' })
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  @IsOptional()
  search?: string;
}
