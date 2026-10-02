import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

// The class's complete list of babs in their new order; a partial list is
// rejected so nothing is silently moved.
export class ReorderChaptersDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  chapter_ids: string[];
}
