import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
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
      'Replaces `expertise`; stored comma-separated (160 characters total).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  expertise_list?: string[];
}
