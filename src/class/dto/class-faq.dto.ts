import { ApiProperty, PartialType } from '@nestjs/swagger';
import { EnumInput, RequiredText } from '~/common/decorator/input.decorator';

export const MAX_CLASS_FAQS = 50;

export class CreateClassFaqDto {
  @RequiredText({
    max: 300,
    example: 'Apakah kelas ini cocok untuk pemula?',
  })
  question: string;

  @RequiredText({ max: 3000, example: 'Ya, materi dimulai dari dasar.' })
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
  @EnumInput(['video', 'live-bootcamp'] as const)
  type: 'video' | 'live-bootcamp';
}
