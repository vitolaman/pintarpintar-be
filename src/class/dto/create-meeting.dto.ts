import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUrl, IsUUID, Matches } from 'class-validator';
import {
  ClearableText,
  NumberInput,
  RequiredText,
} from '~/common/decorator/input.decorator';
import {
  CALENDAR_DATE,
  CLOCK_TIME,
  HTTPS_URL,
  MAX_DESCRIPTION_LENGTH,
} from './content-validation';

export class CreateMeetingDto {
  @RequiredText({ max: 255 })
  title: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
  content?: string | null;

  @ApiProperty({ example: '2026-10-15' })
  @Matches(CALENDAR_DATE, { message: 'date must be YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'date must be a real calendar date' })
  date: string;

  @ApiProperty({ example: '19:30', description: 'HH:mm, Asia/Jakarta' })
  @Matches(CLOCK_TIME, { message: 'time must be HH:mm' })
  time: string;

  @ClearableText({ max: 2048, example: 'https://zoom.us/j/123456789' })
  @IsUrl(HTTPS_URL)
  liveUrl?: string | null;

  @NumberInput({
    presence: 'nullable',
    integer: true,
    min: 1,
    max: 1440,
    example: 90,
    description: 'Minutes, 1–1440. The status treats an unset duration as 180.',
  })
  duration_minutes?: number | null;

  @ApiPropertyOptional({
    description: 'Mentor id of an active tutor of this class',
  })
  @IsUUID()
  @IsOptional()
  mentor_id?: string;
}
