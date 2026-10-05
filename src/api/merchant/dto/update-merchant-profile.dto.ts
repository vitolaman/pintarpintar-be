import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  ValidateIf,
} from 'class-validator';
import { merchantCategoryLabels } from '~/common/constants/merchant-category';
import {
  ClearableText,
  EnumInput,
  NumberInput,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';
import { assetFieldDescription } from '~/api/file-asset/asset-purpose-rules';
import {
  MerchantBusinessType,
  merchantBusinessTypes,
  MerchantProductType,
  ProductTypesInput,
} from '../merchant-onboarding';

// A leading "@" is not part of the handle, so "@" alone clears it.
const stripHandlePrefix = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/^@/, '').trim() || null;
};

export class UpdateMerchantProfileDto {
  @RequiredText({ max: 160, optional: true, example: 'Akademi Teknik' })
  store_name?: string;

  @ClearableText({
    max: 10_000,
    example: '<p><b>Kelas</b> teknologi praktis.</p>',
    description:
      'Rich text; sanitized to bold, italic, underline, lists, alignment, and font sizes 10–32px',
  })
  store_description?: string | null;

  @ClearableText({ max: 32, example: '+62 812-3456-7890' })
  phone?: string | null;

  @ClearableText({ max: 160, example: 'Belajar teknologi dari praktisi.' })
  tagline?: string | null;

  @EnumInput(merchantCategoryLabels, {
    presence: 'nullable',
    example: 'Teknik & Arsitektur',
  })
  category_label?: string | null;

  @EnumInput(merchantBusinessTypes, {
    presence: 'optional',
    example: 'company',
    description:
      'Jenis Merchant from the registration form: individual, institution or company',
  })
  business_type?: MerchantBusinessType;

  @ProductTypesInput({ optional: true })
  product_types?: MerchantProductType[];

  @ClearableText({ max: 120, example: 'Bandung' })
  city?: string | null;

  @ClearableText({ max: 255, example: 'contact@akademi.example' })
  @IsEmail()
  public_email?: string | null;

  @ClearableText({ max: 32, example: '+62 812-3456-7890' })
  public_phone?: string | null;

  @ClearableText({ max: 2_048, example: 'https://akademi.example' })
  @IsUrl({ require_tld: false })
  website_url?: string | null;

  @Transform(stripHandlePrefix)
  @ClearableText({ max: 120, example: 'akademi_teknik' })
  instagram_handle?: string | null;

  @ClearableText({ max: 2_048, example: 'https://youtube.com/@akademi' })
  @IsUrl({ require_tld: false })
  youtube_url?: string | null;

  @ClearableText({
    max: 2_048,
    example: 'https://linkedin.com/company/akademi',
  })
  @IsUrl({ require_tld: false })
  linkedin_url?: string | null;

  @ClearableText({ max: 160, example: 'Frontend engineering' })
  expertise?: string | null;

  @NumberInput({
    presence: 'nullable',
    integer: true,
    min: 0,
    max: 80,
    example: 4,
  })
  experience_years?: number | null;

  @ClearableText({ max: 255, example: 'S1 Teknik Informatika' })
  education?: string | null;

  @ClearableText({ max: 2_048, example: 'https://portfolio.example' })
  @IsUrl({ require_tld: false })
  portfolio_url?: string | null;

  @ClearableText({
    max: 4_000,
    example: 'Refund tersedia sebelum materi diakses.',
  })
  refund_policy?: string | null;

  @ClearableText({
    max: 4_000,
    example: 'Lisensi personal, tidak dapat didistribusikan.',
  })
  digital_license?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: assetFieldDescription(
      'merchant_logo',
      'The store logo; null clears it.',
    ),
  })
  @IsOptional()
  @IsUUID()
  avatar_asset_id?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: assetFieldDescription(
      'merchant_banner',
      'The store banner; null clears it.',
    ),
  })
  @IsOptional()
  @IsUUID()
  cover_asset_id?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['AutoCAD', 'Structural Design'],
    description: 'Bidang badges in display order; replaces the current list',
  })
  @OptionalNotNull()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  skills?: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: assetFieldDescription(
      'merchant_landing_background',
      'null clears it.',
    ),
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  landing_background_asset_id?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: {
      section_order: ['best_seller', 'bootcamp', 'kelas', 'digital', 'bundles'],
      item_order: { best_seller: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'] },
    },
    description:
      'Landing page section order and per-section item order; null resets to the default',
  })
  @IsOptional()
  landing_layout?: Record<string, unknown> | null;
}
