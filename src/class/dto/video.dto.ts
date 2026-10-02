import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUrl, IsUUID, ValidateIf } from 'class-validator';
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
      'Optional: inferred from the field sent (youtubeUrl makes a link video, asset_id a file video). An explicit source must match that field.',
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

  @ClearableText({ max: 32, example: '12:30' })
  duration?: string | null;
}

export class UpdateVideoDto {
  @RequiredText({ max: 255, optional: true })
  title?: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
  description?: string | null;

  @EnumInput(videoSources, {
    presence: 'optional',
    description:
      "Optional: sending youtubeUrl or asset_id switches the source. An explicit source needs that source's field too.",
  })
  source?: VideoSource;

  @RequiredText({ max: 2048, optional: true })
  @IsUrl(HTTPS_URL)
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

  @ClearableText({ max: 32 })
  duration?: string | null;
}
