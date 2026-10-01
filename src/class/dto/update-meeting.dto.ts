import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
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

  @ApiPropertyOptional({
    nullable: true,
    example: 90,
    description: 'Minutes, 1–1440; null clears it',
  })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(1440)
  @IsOptional()
  duration_minutes?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Mentor id of an active tutor of this class; null clears it',
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  @IsOptional()
  mentor_id?: string | null;
}
