import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
  RequiredText,
} from '~/common/decorator/input.decorator';
import { HTTPS_URL, MAX_DESCRIPTION_LENGTH } from './content-validation';
import { assetFieldDescription } from '../../api/file-asset/asset-purpose-rules';

// A video's source follows the field that is filled: youtube_url makes a link
// video, asset_id a file video. A form may send both keys and leave the unused
// one empty, so null, "" and spaces mean the field was not sent.
const EmptyMeansNotSent = () =>
  Transform(({ value }) => {
    if (value === null) return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return value;
  });

const LINK_DESCRIPTION =
  'For a link video: an https YouTube or other video link. Leave it out, null or "" for a file video';

export class CreateVideoDto {
  @RequiredText({ max: 255 })
  title: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
  description?: string | null;

  // Not clearable: a link video needs its link, and a file video takes none.
  @RequiredText({
    max: 2048,
    optional: true,
    example: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: LINK_DESCRIPTION,
  })
  @ApiPropertyOptional({ nullable: true })
  @EmptyMeansNotSent()
  @IsUrl(HTTPS_URL)
  youtube_url?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: assetFieldDescription(
      'class_video',
      'For a file video: the asset_id from upload/complete. Leave it out, null or "" for a link video.',
    ),
  })
  @EmptyMeansNotSent()
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
      'One to 20 videos, stored together after the last item in this order, or none if one is invalid. Each video fills youtube_url (a link) or asset_id (an uploaded file), not both',
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

  @RequiredText({
    max: 2048,
    optional: true,
    description:
      'Filling it on a file video switches it to a link video; empty keeps the current link',
  })
  @ApiPropertyOptional({ nullable: true })
  @EmptyMeansNotSent()
  @IsUrl(HTTPS_URL)
  youtube_url?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: assetFieldDescription(
      'class_video',
      'Replaces the file of a file video, or switches a link video to a file video; empty keeps the current file.',
    ),
  })
  @EmptyMeansNotSent()
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  asset_id?: string;

  @ClearableText({ max: 32 })
  duration?: string | null;
}
