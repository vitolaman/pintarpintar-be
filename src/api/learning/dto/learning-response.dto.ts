import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NextVideoDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() chapter_id: string;
}

export class LearnerProgressResponseDto {
  @ApiProperty() class_id: string;

  @ApiProperty({
    description: 'Completed videos over all videos, whole percent',
  })
  progress: number;

  @ApiPropertyOptional({
    type: NextVideoDto,
    nullable: true,
    description: 'First unfinished video in chapter order; null when done',
  })
  next_video: NextVideoDto | null;
}
