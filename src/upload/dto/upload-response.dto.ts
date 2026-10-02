import { ApiProperty } from '@nestjs/swagger';

export class InitiateUploadResponseDto {
  @ApiProperty()
  uploadId: string;

  @ApiProperty({ example: 'uploads/<userId>/1790900000000-denah.dwg' })
  key: string;
}

export class PresignedPartUrlDto {
  @ApiProperty({ example: 1 })
  partNumber: number;

  @ApiProperty({ description: 'PUT the part here; expires in one hour' })
  url: string;
}

export class CompleteUploadResponseDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  location: string;

  @ApiProperty()
  bucket: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Send this in the form field the file is for (cover, CV, material, ...)',
  })
  asset_id: string;
}
