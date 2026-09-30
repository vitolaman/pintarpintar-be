import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';
import { imagePurposes, ImagePurpose } from '../image-asset-rules';

export class RegisterUploadDto {
  @ApiProperty({
    example: 'uploads/1790900000000-logo.png',
    description: 'Key returned by the completed multipart upload',
  })
  @IsString()
  @MaxLength(512)
  @Matches(/^uploads\/[^/]+$/, {
    message: 'key must be an uploads/ object key',
  })
  key: string;

  @ApiProperty({ enum: imagePurposes })
  @IsIn(imagePurposes)
  purpose: ImagePurpose;
}

export class FileAssetResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'uploads/1790900000000-logo.png' })
  object_key: string;

  @ApiProperty({ example: 'logo.png' })
  original_filename: string;

  @ApiProperty({ example: 'image/png' })
  mime_type: string;

  @ApiProperty({ example: 512000 })
  size_bytes: number;

  @ApiProperty({ example: 'public' })
  visibility: string;
}
