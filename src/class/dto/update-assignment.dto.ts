import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { assetFieldDescription } from '../../api/file-asset/asset-purpose-rules';
import {
  ClearableText,
  EnumInput,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';
import { AssignmentType } from '../entities/assignment.entity';
import { MAX_DESCRIPTION_LENGTH } from './content-validation';
import { CreateQuestionDto } from './create-assignment.dto';

// The create fields, each optional. Omitted fields keep their value.
export class UpdateAssignmentDto {
  @RequiredText({ max: 255, optional: true })
  title?: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
  description?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-15T23:59:00+07:00',
    description: 'Due date and time with offset; must be in the future',
  })
  @OptionalNotNull()
  @IsISO8601({ strict: true })
  due?: string;

  @EnumInput(Object.values(AssignmentType), {
    presence: 'optional',
    description:
      'Cannot change between file_upload and quiz once learners have submitted',
  })
  type?: AssignmentType;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: assetFieldDescription(
      'assignment_resource',
      'null removes the resource.',
    ),
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  @IsOptional()
  resource_asset_id?: string | null;

  @ApiPropertyOptional({
    type: [CreateQuestionDto],
    description:
      'Replaces all questions of a quiz. Refused once learners have submitted, unless the questions are unchanged',
  })
  @OptionalNotNull()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}
