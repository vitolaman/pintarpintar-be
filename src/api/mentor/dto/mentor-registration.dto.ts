import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';
import { trimText } from '~/common/dto/text-transforms';

export class MentorRegistrationDto {
  @ApiProperty({ example: '+62 812-3456-7890' })
  @IsString()
  @Length(1, 32)
  @Transform(trimText)
  phone: string;

  @ApiPropertyOptional({ example: 'Praktisi Data Science' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  @Transform(trimText)
  headline?: string;

  @ApiPropertyOptional({ example: 'Berpengalaman mengajar kelas data.' })
  @IsOptional()
  @IsString()
  @Length(1, 2_000)
  @Transform(trimText)
  bio?: string;

  @ApiProperty({ example: 'Data science' })
  @IsString()
  @Length(1, 160)
  @Transform(trimText)
  expertise: string;

  @ApiProperty({ example: 4, minimum: 0, maximum: 80 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(80)
  experience_years: number;

  @ApiProperty({ example: 'S1 Teknik Informatika' })
  @IsString()
  @Length(1, 255)
  @Transform(trimText)
  education: string;

  @ApiPropertyOptional({ example: 'https://portfolio.example' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @Length(1, 2_048)
  @Transform(trimText)
  portfolio_url?: string;

  @ApiProperty({ example: 'https://linkedin.com/in/example' })
  @IsUrl({ require_tld: false })
  @Length(1, 2_048)
  @Transform(trimText)
  linkedin_url: string;
}
