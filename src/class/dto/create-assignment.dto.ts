import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AssignmentType } from '../entities/assignment.entity';
import { QuestionType } from '../entities/assignment-question.entity';
import { assetFieldDescription } from '../../api/file-asset/asset-purpose-rules';
import {
  ClearableText,
  EnumInput,
  NumberInput,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { MAX_DESCRIPTION_LENGTH } from './content-validation';

// Options are trimmed like the correct answer, so the answer still matches
// the option it was copied from.
const trimEachText = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
    : value;

export class CreateQuestionDto {
  @RequiredText({ max: 5000 })
  question_text: string;

  @EnumInput(Object.values(QuestionType))
  type: QuestionType;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Two to four options, required for multiple_choice',
  })
  @Transform(trimEachText)
  @ValidateIf((question) => question.type === QuestionType.MULTIPLE_CHOICE)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(1000, { each: true })
  options?: string[];

  // A multiple-choice question without a correct answer is rejected by the
  // service, which checks that the answer is one of the options.
  @ClearableText({
    max: 5000,
    description:
      'For multiple_choice, the text of the correct option (required); for essay, an optional answer key',
  })
  correct_answer?: string | null;

  @NumberInput({ presence: 'optional', integer: true, min: 0, default: 0 })
  score_weight?: number;
}

export class CreateAssignmentDto {
  @RequiredText({ max: 255 })
  title: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
  description?: string | null;

  @ApiProperty({
    example: '2026-10-15T23:59:00+07:00',
    description: 'Due date and time with offset; must be in the future',
  })
  @IsISO8601({ strict: true })
  due: string;

  @EnumInput(Object.values(AssignmentType))
  type: AssignmentType;

  @ApiProperty({
    required: false,
    format: 'uuid',
    description: assetFieldDescription('assignment_resource'),
  })
  @IsUUID()
  @IsOptional()
  resource_asset_id?: string;

  @ApiProperty({
    type: [CreateQuestionDto],
    required: false,
    description: 'At least one for a quiz; not used by file_upload',
  })
  @ValidateIf(
    (assignment) =>
      assignment.type === AssignmentType.QUIZ ||
      assignment.questions !== undefined,
  )
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}
