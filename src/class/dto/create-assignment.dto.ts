import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AssignmentType } from '../entities/assignment.entity';
import { QuestionType } from '../entities/assignment-question.entity';

export class CreateQuestionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question_text: string;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  @IsNotEmpty()
  type: QuestionType;

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsOptional()
  options?: any[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  correct_answer?: string;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @IsOptional()
  score_weight?: number;
}

export class CreateAssignmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  due: string; // ISO date string

  @ApiProperty({ enum: AssignmentType })
  @IsEnum(AssignmentType)
  @IsNotEmpty()
  type: AssignmentType;

  @ApiProperty({ type: [CreateQuestionDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  @IsOptional()
  questions?: CreateQuestionDto[];
}
