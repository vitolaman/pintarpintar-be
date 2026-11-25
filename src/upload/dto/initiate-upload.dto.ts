import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

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
}
