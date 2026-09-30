import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { MentorRegistrationDto } from './mentor-registration.dto';

export class UpdateMentorDto extends PartialType(MentorRegistrationDto) {
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
