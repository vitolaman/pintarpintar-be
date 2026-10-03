import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { MentorRegistrationDto } from './mentor-registration.dto';

// Every field may be omitted. Null is still validated, so it clears only the
// clearable fields (headline, bio, portfolio_url) and is rejected for the
// fields registration requires.
export class UpdateMentorDto extends PartialType(MentorRegistrationDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional({
    type: [String],
    example: ['AutoCAD', 'SAP2000'],
    description:
      'At most 20 skills of 1–60 characters; trimmed, blanks and case-insensitive duplicates removed. Stored comma-separated as `expertise` (160 characters total), and takes precedence over `expertise` when both are sent.',
  })
  // Validated whenever sent, so null is rejected like the other fields.
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  expertise_list?: string[];
}
