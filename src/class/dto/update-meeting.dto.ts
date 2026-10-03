import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsOptional,
  IsUrl,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
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

export class UpdateMeetingDto {
  @RequiredText({ max: 255, optional: true })
  title?: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
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

  @ClearableText({ max: 2048 })
  @IsUrl(HTTPS_URL)
  live_url?: string | null;

  @NumberInput({
    presence: 'nullable',
    integer: true,
    min: 1,
    max: 1440,
    example: 90,
    description: 'Minutes, 1–1440; null clears it',
  })
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
