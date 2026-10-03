import { ApiProperty } from '@nestjs/swagger';

export class PublicFaqEntryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  question: string;

  @ApiProperty()
  answer: string;

  @ApiProperty()
  display_order: number;
}

export class PublicFaqCategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  display_order: number;

  @ApiProperty({ type: [PublicFaqEntryResponseDto] })
  faqs: PublicFaqEntryResponseDto[];
}

export class PublicFaqMetaResponseDto {
  @ApiProperty({
    description: 'Active categories with at least one active question',
  })
  category_count: number;

  @ApiProperty({ description: 'Active questions in those categories' })
  question_count: number;
}

export class PublicFaqResponseDto {
  @ApiProperty({ type: [PublicFaqCategoryResponseDto] })
  categories: PublicFaqCategoryResponseDto[];

  @ApiProperty({ type: PublicFaqMetaResponseDto })
  meta: PublicFaqMetaResponseDto;
}
