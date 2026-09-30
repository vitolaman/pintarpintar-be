import { ApiProperty } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
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
}
