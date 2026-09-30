import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { merchantCategoryLabels } from '~/common/constants/merchant-category';
import { trimOptionalText, trimText } from '~/common/dto/text-transforms';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';

export class UpdateMerchantProfileDto {
  @ApiPropertyOptional({ example: 'Akademi Teknik' })
  @OptionalNotNull()
  @IsString()
  @Length(1, 120)
  @Transform(trimText)
  store_name?: string;

  @ApiPropertyOptional({
    example: '<p><b>Kelas</b> teknologi praktis.</p>',
    description:
      'Rich text; sanitized to bold, italic, underline, lists, alignment, and font sizes 10–32px',
  })
  @IsOptional()
  @IsString()
  @Length(1, 10_000)
  @Transform(trimText)
  store_description?: string;

  @ApiPropertyOptional({ example: '+62 812-3456-7890' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Transform(trimText)
  phone?: string;

  @ApiPropertyOptional({ example: 'Belajar teknologi dari praktisi.' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  @Transform(trimText)
  tagline?: string;

  @ApiPropertyOptional({
    enum: merchantCategoryLabels,
    nullable: true,
    example: 'Teknik & Arsitektur',
  })
  @IsOptional()
  @IsIn(merchantCategoryLabels)
  @Transform(trimOptionalText)
  category_label?: string | null;

  @ApiPropertyOptional({ example: 'Bandung' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Transform(trimText)
  city?: string;

  @ApiPropertyOptional({ example: 'contact@akademi.example' })
  @IsOptional()
  @IsEmail()
  @Length(1, 255)
  @Transform(trimText)
  public_email?: string;

  @ApiPropertyOptional({ example: '+62 812-3456-7890' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Transform(trimText)
  public_phone?: string;

  @ApiPropertyOptional({ example: 'https://akademi.example' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(1, 2_048)
  @Transform(trimText)
  website_url?: string;

  @ApiPropertyOptional({ example: 'akademi_teknik' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/^@/, '') : value,
  )
  instagram_handle?: string;

  @ApiPropertyOptional({ example: 'https://youtube.com/@akademi' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(1, 2_048)
  @Transform(trimText)
  youtube_url?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/company/akademi' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(1, 2_048)
  @Transform(trimText)
  linkedin_url?: string;

  @ApiPropertyOptional({ example: 'Frontend engineering' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  @Transform(trimText)
  expertise?: string;

  @ApiPropertyOptional({ example: 4, minimum: 0, maximum: 80 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  experience_years?: number;

  @ApiPropertyOptional({ example: 'S1 Teknik Informatika' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Transform(trimText)
  education?: string;

  @ApiPropertyOptional({ example: 'https://portfolio.example' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(1, 2_048)
  @Transform(trimText)
  portfolio_url?: string;

  @ApiPropertyOptional({ example: 'Refund tersedia sebelum materi diakses.' })
  @IsOptional()
  @IsString()
  @Length(1, 4_000)
  @Transform(trimText)
  refund_policy?: string;

  @ApiPropertyOptional({
    example: 'Lisensi personal, tidak dapat didistribusikan.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 4_000)
  @Transform(trimText)
  digital_license?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Store logo: own registered image asset (max 2 MB), null clears it',
  })
  @IsOptional()
  @IsUUID()
  avatar_asset_id?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Store banner: own registered image asset (max 4 MB), null clears it',
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
    description: 'Registered upload with purpose merchant_landing_background',
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
