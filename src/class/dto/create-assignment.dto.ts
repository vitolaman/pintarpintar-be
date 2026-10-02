import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AssignmentType } from '../entities/assignment.entity';
import { QuestionType } from '../entities/assignment-question.entity';
import { assetFieldDescription } from '../../api/file-asset/asset-purpose-rules';

export class CreateQuestionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  question_text: string;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Two to four options, required for multiple_choice',
  })
  @ValidateIf((question) => question.type === QuestionType.MULTIPLE_CHOICE)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(1000, { each: true })
  options?: string[];

  @ApiProperty({
    required: false,
    description:
      'For multiple_choice, the text of the correct option; for essay, an optional answer key',
  })
  @ValidateIf((question) => question.type === QuestionType.MULTIPLE_CHOICE)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  correct_answer?: string;

  @ApiProperty({ default: 0, minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  score_weight?: number;
}

export class CreateAssignmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '2026-10-15T23:59:00+07:00',
    description: 'Due date and time with offset; must be in the future',
  })
  @IsISO8601({ strict: true })
  due: string;

  @ApiProperty({ enum: AssignmentType })
  @IsEnum(AssignmentType)
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
