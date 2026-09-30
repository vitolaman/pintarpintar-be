import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CALENDAR_DATE, CLOCK_TIME, HTTPS_URL } from './content-validation';

export class UpdateMeetingDto {
  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsOptional()
  content?: string | null;

  @ApiPropertyOptional({ example: '2026-10-15' })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(CALENDAR_DATE, { message: 'date must be YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'date must be a real calendar date' })
  date?: string;

  @ApiPropertyOptional({ example: '19:30', description: 'HH:mm, Asia/Jakarta' })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(CLOCK_TIME, { message: 'time must be HH:mm' })
  time?: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsUrl(HTTPS_URL)
  @MaxLength(2048)
  @IsOptional()
  liveUrl?: string | null;
}
