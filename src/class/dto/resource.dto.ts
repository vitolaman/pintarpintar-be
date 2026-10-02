import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ResourceType } from '../entities/file-resource.entity';
import { HTTPS_URL } from './content-validation';
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
  @ApiProperty({ enum: WRITABLE_RESOURCE_TYPES })
  @IsIn(WRITABLE_RESOURCE_TYPES)
  type: (typeof WRITABLE_RESOURCE_TYPES)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    required: false,
    format: 'uuid',
    description: assetFieldDescription(
      'class_resource',
      'Required unless type is link.',
    ),
  })
  @ValidateIf((resource) => resource.type !== ResourceType.LINK)
  @IsUUID()
  asset_id?: string;

  @ApiProperty({
    required: false,
    description: 'Required https URL for type link',
  })
  @ValidateIf((resource) => resource.type === ResourceType.LINK)
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
  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ description: 'Only for link resources' })
  @ValidateIf((_, value) => value !== undefined)
  @IsUrl(HTTPS_URL)
  @MaxLength(2048)
  url?: string;
}
