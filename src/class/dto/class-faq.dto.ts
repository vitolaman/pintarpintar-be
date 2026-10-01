import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';
import { trimText } from '../../common/dto/text-transforms';

export const MAX_CLASS_FAQS = 50;

export class CreateClassFaqDto {
  @ApiProperty({ example: 'Apakah kelas ini cocok untuk pemula?' })
  @Transform(trimText)
  @IsString()
  @Length(1, 300)
  question: string;

  @ApiProperty({ example: 'Ya, materi dimulai dari dasar.' })
  @Transform(trimText)
  @IsString()
  @Length(1, 3000)
  answer: string;
}

// Null is validated, so it is rejected.
export class UpdateClassFaqDto extends PartialType(CreateClassFaqDto, {
  skipNullProperties: false,
}) {}

export class ClassFaqResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() question: string;
  @ApiProperty() answer: string;
}

export class DuplicateClassDto {
  @ApiProperty({ enum: ['video', 'live-bootcamp'] })
  @IsIn(['video', 'live-bootcamp'])
  type: 'video' | 'live-bootcamp';
}
