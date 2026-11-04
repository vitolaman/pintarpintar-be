import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsUrl,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ClearableText,
  EnumInput,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { HTTPS_URL, MAX_DESCRIPTION_LENGTH } from './content-validation';
import { VideoSource, videoSources } from '../entities/video.entity';
import { assetFieldDescription } from '../../api/file-asset/asset-purpose-rules';

export class CreateVideoDto {
  @RequiredText({ max: 255 })
  title: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
  description?: string | null;

  @EnumInput(videoSources, {
    presence: 'filter',
    description:
      'Optional: inferred from the field sent (youtube_url makes a link video, asset_id a file video). An explicit source must match that field.',
  })
  source?: VideoSource;

  // Not clearable: a link video needs its link, and a file video takes none.
  @RequiredText({
    max: 2048,
    optional: true,
    example: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description:
      'Required for a link video: an https YouTube or other video link',
  })
  @IsUrl(HTTPS_URL)
  youtube_url?: string;

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

  @ClearableText({ max: 32, example: '12:30' })
  duration?: string | null;
}

export const MAX_VIDEOS_PER_REQUEST = 20;

export class CreateVideosDto {
  @ApiProperty({
    type: [CreateVideoDto],
    minItems: 1,
    maxItems: MAX_VIDEOS_PER_REQUEST,
    description:
      'Several videos at once, each like the single-video body; stored together in this order after the last item, or none if one is invalid',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_VIDEOS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => CreateVideoDto)
  videos: CreateVideoDto[];
}

export class UpdateVideoDto {
  @RequiredText({ max: 255, optional: true })
  title?: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
  description?: string | null;

  @EnumInput(videoSources, {
    presence: 'optional',
    description:
      "Optional: sending youtube_url or asset_id switches the source. An explicit source must match the field sent; switching needs that source's field.",
  })
  source?: VideoSource;

  @RequiredText({ max: 2048, optional: true })
  @IsUrl(HTTPS_URL)
  youtube_url?: string;

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

  @ClearableText({ max: 32 })
  duration?: string | null;
}
