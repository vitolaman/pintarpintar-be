import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { HTTPS_URL } from './content-validation';
import { VideoSource, videoSources } from '../entities/video.entity';
import { assetFieldDescription } from '../../api/file-asset/asset-purpose-rules';

export class CreateVideoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: videoSources,
    default: 'link',
    description:
      'link: send youtubeUrl. file: send asset_id (a class_video upload)',
  })
  @IsIn(videoSources)
  @IsOptional()
  source?: VideoSource;

  @ApiPropertyOptional({
    example: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description:
      'Required for a link video: an https YouTube or other video link',
  })
  @IsUrl(HTTPS_URL)
  @MaxLength(2048)
  @IsOptional()
  youtubeUrl?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: assetFieldDescription(
      'class_video',
      'Required for a file video.',
    ),
  })
  @IsUUID()
  @IsOptional()
  asset_id?: string;

  @ApiProperty({ required: false, example: '12:30' })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  duration?: string;
}

export class UpdateVideoDto {
  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({
    enum: videoSources,
    description: "Switching the source needs that source's field too",
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(videoSources)
  source?: VideoSource;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsUrl(HTTPS_URL)
  @MaxLength(2048)
  youtubeUrl?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: assetFieldDescription(
      'class_video',
      'Replaces the file of a file video.',
    ),
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  asset_id?: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(32)
  @IsOptional()
  duration?: string | null;
}
