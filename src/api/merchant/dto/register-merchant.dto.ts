import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';

export class RegisterMerchantDto {
  @ApiProperty({ example: '+62 812-3456-7890' })
  @IsString()
  @Length(1, 32)
  @Transform(({ value }) => value?.trim())
  phone: string;

  @ApiProperty({ example: 'Frontend engineering' })
  @IsString()
  @Length(1, 160)
  @Transform(({ value }) => value?.trim())
  expertise: string;

  @ApiProperty({ example: 4, minimum: 0, maximum: 80 })
  @IsInt()
  @Min(0)
  @Max(80)
  experience_years: number;

  @ApiProperty({ example: 'S1 Teknik Informatika' })
  @IsString()
  @Length(1, 255)
  @Transform(({ value }) => value?.trim())
  education: string;

  @ApiProperty({ example: 'Berpengalaman membangun produk web.' })
  @IsString()
  @Length(1, 2_000)
  @Transform(({ value }) => value?.trim())
  bio: string;

  @ApiPropertyOptional({ example: 'https://portfolio.example' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(1, 2_048)
  @Transform(({ value }) => value?.trim())
  portfolio_url?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/in/example' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(1, 2_048)
  @Transform(({ value }) => value?.trim())
  linkedin_url?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true, { message: 'terms_accepted must be true' })
  terms_accepted: boolean;
}
