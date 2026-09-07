import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpdateMyMerchantDto {
  @ApiPropertyOptional({ example: 'Akademi Teknik' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Transform(({ value }) => value?.trim())
  store_name?: string;

  @ApiPropertyOptional({ example: 'Kelas teknologi praktis.' })
  @IsOptional()
  @IsString()
  @Length(1, 2_000)
  @Transform(({ value }) => value?.trim())
  store_description?: string;

  @ApiPropertyOptional({ example: '+62 812-3456-7890' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Transform(({ value }) => value?.trim())
  phone?: string;

  @ApiPropertyOptional({ example: 'Belajar teknologi dari praktisi.' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  @Transform(({ value }) => value?.trim())
  tagline?: string;

  @ApiPropertyOptional({ example: 'Teknologi' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Transform(({ value }) => value?.trim())
  category_label?: string;

  @ApiPropertyOptional({ example: 'Bandung' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Transform(({ value }) => value?.trim())
  city?: string;

  @ApiPropertyOptional({ example: 'contact@akademi.example' })
  @IsOptional()
  @IsEmail()
  @Length(1, 255)
  @Transform(({ value }) => value?.trim())
  public_email?: string;

  @ApiPropertyOptional({ example: '+62 812-3456-7890' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Transform(({ value }) => value?.trim())
  public_phone?: string;

  @ApiPropertyOptional({ example: 'https://akademi.example' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(1, 2_048)
  @Transform(({ value }) => value?.trim())
  website_url?: string;

  @ApiPropertyOptional({ example: 'akademi_teknik' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Transform(({ value }) => value?.trim().replace(/^@/, ''))
  instagram_handle?: string;

  @ApiPropertyOptional({ example: 'https://youtube.com/@akademi' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(1, 2_048)
  @Transform(({ value }) => value?.trim())
  youtube_url?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/company/akademi' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(1, 2_048)
  @Transform(({ value }) => value?.trim())
  linkedin_url?: string;

  @ApiPropertyOptional({ example: 'Frontend engineering' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  @Transform(({ value }) => value?.trim())
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
  @Transform(({ value }) => value?.trim())
  education?: string;

  @ApiPropertyOptional({ example: 'https://portfolio.example' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(1, 2_048)
  @Transform(({ value }) => value?.trim())
  portfolio_url?: string;

  @ApiPropertyOptional({ example: 'Refund tersedia sebelum materi diakses.' })
  @IsOptional()
  @IsString()
  @Length(1, 4_000)
  @Transform(({ value }) => value?.trim())
  refund_policy?: string;

  @ApiPropertyOptional({
    example: 'Lisensi personal, tidak dapat didistribusikan.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 4_000)
  @Transform(({ value }) => value?.trim())
  digital_license?: string;
}
