import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class EssayScoreDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  question_id: string;

  @ApiProperty({ minimum: 0, description: 'At most the question weight' })
  @IsInt()
  @Min(0)
  score: number;
}

export class GradeSubmissionDto {
  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    description: 'File assignments only',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiPropertyOptional({
    type: [EssayScoreDto],
    description: 'Quizzes only: scores of essay answers',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EssayScoreDto)
  essay_scores?: EssayScoreDto[];

  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  feedback?: string | null;
}

export class SubmissionAnswerViewDto {
  @ApiProperty() question_id: string;
  @ApiProperty() question_text: string;
  @ApiProperty({ enum: ['multiple_choice', 'essay'] }) type: string;
  @ApiProperty() score_weight: number;
  @ApiPropertyOptional({ nullable: true }) user_answer: string | null;
  @ApiPropertyOptional({ nullable: true }) is_correct: boolean | null;
  @ApiPropertyOptional({ nullable: true }) score_awarded: number | null;
}

export class SubmissionLearnerDto {
  @ApiProperty() user_id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) avatar_url: string | null;
}

export class SubmissionViewDto {
  @ApiProperty() id: string;
  @ApiProperty() assignment_id: string;
  @ApiProperty({ type: SubmissionLearnerDto }) learner: SubmissionLearnerDto;
  @ApiProperty() submitted_at: Date;
  @ApiProperty() is_late: boolean;
  @ApiPropertyOptional({ nullable: true }) file_name: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Signed link valid 10 minutes',
  })
  file_download_url: string | null;
  @ApiProperty({ type: [SubmissionAnswerViewDto] })
  answers: SubmissionAnswerViewDto[];
  @ApiPropertyOptional({ nullable: true }) score: number | null;
  @ApiPropertyOptional({ nullable: true }) feedback: string | null;
  @ApiPropertyOptional({ nullable: true }) graded_at: Date | null;
  @ApiProperty({ enum: ['submitted', 'graded'] }) status: string;
}

export class GradeTableAssignmentDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() type: string;
  @ApiPropertyOptional({ nullable: true }) due: Date | null;
}

export class GradeTableScoreDto {
  @ApiProperty() assignment_id: string;
  @ApiPropertyOptional({ nullable: true }) score: number | null;
}

export class GradeTableLearnerDto {
  @ApiProperty() user_id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ type: [GradeTableScoreDto] }) scores: GradeTableScoreDto[];
  @ApiPropertyOptional({
    nullable: true,
    description: 'Average of graded assignments',
  })
  average_score: number | null;
}

export class GradeTableDto {
  @ApiProperty({ type: [GradeTableAssignmentDto] })
  assignments: GradeTableAssignmentDto[];
  @ApiPropertyOptional({
    nullable: true,
    description: 'Mean of learner averages',
  })
  class_average: number | null;
  @ApiProperty({ type: [GradeTableLearnerDto] })
  learners: GradeTableLearnerDto[];
}
