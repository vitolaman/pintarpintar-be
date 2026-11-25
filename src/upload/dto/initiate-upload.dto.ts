import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class InitiateUploadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({
    example: 'image/jpeg',
    description:
      'Stored as the file type. Files that are not images (SVG included), video, audio or PDF are stored with Content-Disposition: attachment, so their links download instead of opening.',
  })
  @IsString()
  @IsNotEmpty()
  contentType: string;

  @ApiPropertyOptional({
    example: 1048576,
    minimum: 0,
    description:
      'Size of the file in bytes. When sent, a file larger than the caller may upload is refused here with 400, before any part is sent. The stored size is checked on complete either way.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  fileSize?: number;
}
