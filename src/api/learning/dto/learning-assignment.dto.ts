import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { assetFieldDescription } from '~/api/file-asset/asset-purpose-rules';

export class LearnerResourceDto {
  @ApiProperty() name: string;
  @ApiProperty({ description: 'Bytes' }) size: number;
  @ApiProperty({ description: 'Signed link valid 10 minutes' })
  download_url: string;
}

export class LearnerSubmissionDto {
  @ApiProperty() id: string;
  @ApiProperty() submitted_at: Date;
  @ApiProperty() is_late: boolean;
  @ApiPropertyOptional({ nullable: true }) file_name: string | null;
  @ApiPropertyOptional({ nullable: true, description: '0–100 once graded' })
  score: number | null;
  @ApiPropertyOptional({ nullable: true }) feedback: string | null;
  @ApiProperty({ enum: ['submitted', 'graded'] }) status: string;
}

export class LearnerAssignmentDto {
  @ApiProperty() id: string;
  @ApiProperty() class_id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty({ enum: ['file_upload', 'quiz'] }) type: string;
  @ApiPropertyOptional({ nullable: true }) due: Date | null;
  @ApiProperty() is_past_due: boolean;
  @ApiProperty() question_count: number;
  @ApiProperty({ description: 'Sum of question weights' })
  total_weight: number;
  @ApiPropertyOptional({ type: LearnerResourceDto, nullable: true })
  resource: LearnerResourceDto | null;
  @ApiPropertyOptional({ type: LearnerSubmissionDto, nullable: true })
  my_submission: LearnerSubmissionDto | null;
}

export class LearnerQuestionDto {
  @ApiProperty() id: string;
  @ApiProperty() question_text: string;
  @ApiProperty({ enum: ['multiple_choice', 'essay'] }) type: string;
  @ApiPropertyOptional({ type: [String], nullable: true })
  options: string[] | null;
  @ApiProperty() score_weight: number;
}

export class LearnerQuizDto extends LearnerAssignmentDto {
  @ApiProperty({
    type: [LearnerQuestionDto],
    description: 'Never includes answer keys',
  })
  questions: LearnerQuestionDto[];
}

export class SubmitAssignmentDto {
  @ApiProperty({
    format: 'uuid',
    description: assetFieldDescription('submission_file'),
  })
  @IsUUID()
  file_asset_id: string;
}

export class QuizAnswerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  question_id: string;

  @ApiProperty({
    description: 'The chosen option text, or the essay answer',
  })
  @IsString()
  @MaxLength(10000)
  answer: string;
}

export class SubmitQuizDto {
  @ApiProperty({ type: [QuizAnswerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];
}

export class LearnerGradeDto {
  @ApiProperty() assignment_id: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: ['file_upload', 'quiz'] }) type: string;
  @ApiPropertyOptional({ nullable: true }) due: Date | null;
  @ApiPropertyOptional({ nullable: true, description: '0–100' })
  score: number | null;
  @ApiPropertyOptional({ nullable: true }) feedback: string | null;
  @ApiProperty({ enum: ['not_submitted', 'submitted', 'graded'] })
  status: string;
}

export class LearnerGradesDto {
  @ApiProperty() class_id: string;
  @ApiProperty({ type: [LearnerGradeDto] }) assignments: LearnerGradeDto[];
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Partisipasi: attendance percentage; null until a meeting has started',
  })
  participation: number | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Average of graded assignments',
  })
  average_score: number | null;
}
