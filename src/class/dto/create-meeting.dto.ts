import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
} from 'class-validator';
import { CALENDAR_DATE, CLOCK_TIME, HTTPS_URL } from './content-validation';

export class CreateMeetingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({ example: '2026-10-15' })
  @Matches(CALENDAR_DATE, { message: 'date must be YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'date must be a real calendar date' })
  date: string;

  @ApiProperty({ example: '19:30', description: 'HH:mm, Asia/Jakarta' })
  @Matches(CLOCK_TIME, { message: 'time must be HH:mm' })
  time: string;

  @ApiProperty({ required: false, example: 'https://zoom.us/j/123456789' })
  @IsUrl(HTTPS_URL)
  @MaxLength(2048)
  @IsOptional()
  liveUrl?: string;

  @ApiPropertyOptional({
    example: 90,
    description: 'Minutes, 1–1440. The status treats an unset duration as 180.',
  })
  @IsInt()
  @Min(1)
  @Max(1440)
  @IsOptional()
  duration_minutes?: number;

  @ApiPropertyOptional({
    description: 'Mentor id of an active tutor of this class',
  })
  @IsUUID()
  @IsOptional()
  mentor_id?: string;
}
