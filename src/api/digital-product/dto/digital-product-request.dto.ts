import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
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

export const productStatuses = [
  'published',
  'unpublished',
  'unlisted',
] as const;

export type ProductStatus = (typeof productStatuses)[number];

const CATEGORY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CATEGORY_SLUG_DESCRIPTION =
  'Slug of any category in GET /api/v1/catalog/categories, a sub-category included: pdf, template, e-book, project-files, template-canva, excel, desain-grafis (sub-categories photoshop, illustrator, figma), videografi (sub-categories video-effect, sound-effect, video-animasi), lainnya';

export class CreateDigitalProductDto {
  @RequiredText({ max: 255, example: 'Template RAB Excel Proyek Rumah' })
  title: string;

  @ClearableText({ max: 10000 })
  description?: string | null;

  @ApiProperty({ example: 'excel', description: CATEGORY_SLUG_DESCRIPTION })
  @Matches(CATEGORY_SLUG, { message: 'category_slug must be a category slug' })
  category_slug: string;

  @NumberInput({
    min: 0,
    example: 150000,
    description: 'List price (Harga Asli)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  original_price: number;

  @NumberInput({
    presence: 'nullable',
    min: 0,
    example: 99000,
    description:
      'Selling price when greater than 0; must not exceed original_price',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  discount_price?: number | null;

  @EnumInput(productStatuses, {
    presence: 'optional',
    default: 'unpublished',
    example: 'unpublished',
  })
  status?: ProductStatus;

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

  @ClearableText({ max: 5000 })
  post_purchase_instructions?: string | null;
}

// Omitted fields stay unchanged; null clears a nullable field.
export class UpdateDigitalProductDto {
  @RequiredText({ max: 255, optional: true })
  title?: string;

  @ClearableText({ max: 10000 })
  description?: string | null;

  @ApiPropertyOptional({
    example: 'excel',
    description: CATEGORY_SLUG_DESCRIPTION,
  })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(CATEGORY_SLUG, { message: 'category_slug must be a category slug' })
  category_slug?: string;

  @NumberInput({ presence: 'optional', min: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  original_price?: number;

  @NumberInput({
    presence: 'nullable',
    min: 0,
    description: 'Null or 0 removes the discount',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  discount_price?: number | null;

  @EnumInput(productStatuses, { presence: 'optional' })
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

  @ClearableText({ max: 5000 })
  post_purchase_instructions?: string | null;
}

export class DigitalProductListQueryDto {
  @PageQuery()
  page?: number = 1;

  @LimitQuery()
  limit?: number = 10;

  @EnumInput(productStatuses, {
    presence: 'filter',
    description: 'A blank value means every status',
  })
  status?: ProductStatus;

  @ApiPropertyOptional({
    maxLength: 255,
    description: 'Matches the title; a blank value means no search',
  })
  @QueryFilter()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}
