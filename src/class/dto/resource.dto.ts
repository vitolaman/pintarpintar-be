import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ResourceType } from '../entities/file-resource.entity';
import {
  ClearableText,
  EnumInput,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { HTTPS_URL, MAX_DESCRIPTION_LENGTH } from './content-validation';
import { assetFieldDescription } from '../../api/file-asset/asset-purpose-rules';

// Older rows may still carry `video` or `zip`; new resources use these.
export const WRITABLE_RESOURCE_TYPES = [
  ResourceType.PDF,
  ResourceType.ARCHIVE,
  ResourceType.IMAGE,
  ResourceType.FILE,
  ResourceType.LINK,
] as const;

export class CreateResourceDto {
  @EnumInput(WRITABLE_RESOURCE_TYPES, {
    presence: 'filter',
    description:
      'Optional and informational: the type is derived from the uploaded file (pdf, archive, image, file), or link for a url',
  })
  type?: (typeof WRITABLE_RESOURCE_TYPES)[number];

  @RequiredText({ max: 255 })
  name: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
  description?: string | null;

  @ApiProperty({
    required: false,
    format: 'uuid',
    description: assetFieldDescription(
      'class_resource',
      'Send this or url, not both.',
    ),
  })
  @IsOptional()
  @IsUUID()
  asset_id?: string;

  @ApiProperty({
    required: false,
    description: 'An https link; send this or asset_id, not both',
  })
  @IsOptional()
  @IsUrl(HTTPS_URL)
  @MaxLength(2048)
  url?: string;
}

export class AddResourcesDto {
  @ApiProperty({ type: [CreateResourceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateResourceDto)
  resources: CreateResourceDto[];
}

export class UpdateResourceDto {
  @RequiredText({ max: 255, optional: true })
  name?: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
  description?: string | null;

  // Not clearable: a link resource always keeps its URL.
  @RequiredText({
    max: 2048,
    optional: true,
    description: 'Only for link resources',
  })
  @IsUrl(HTTPS_URL)
  url?: string;
}
