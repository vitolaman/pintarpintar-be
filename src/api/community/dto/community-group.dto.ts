import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  ClearableText,
  EnumInput,
  QueryFilter,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import { assetFieldDescription } from '~/api/file-asset/asset-purpose-rules';
import {
  GROUP_ACCESS,
  GroupAccess,
  MAX_GROUP_DESCRIPTION,
  MAX_GROUP_NAME,
  Membership,
} from '../community.constants';

export class CreateCommunityGroupDto {
  @RequiredText({ max: MAX_GROUP_NAME, example: 'Revit Indonesia' })
  name: string;

  @ApiProperty({
    format: 'uuid',
    description: assetFieldDescription('community_group_image', 'Gambar Grup.'),
  })
  @IsUUID()
  image_asset_id: string;

  @ClearableText({
    max: MAX_GROUP_DESCRIPTION,
    example: 'Diskusi pemodelan Revit dan BIM.',
  })
  description?: string | null;

  @EnumInput(GROUP_ACCESS, {
    example: 'public',
    description:
      'public: anyone joins at once; request: the owner accepts each request',
  })
  access: GroupAccess;
}

export class CommunityGroupListQueryDto extends RequestPaginatedQueryDto {
  @ApiPropertyOptional({
    description: 'Matches part of the group name (literal). Blank means none.',
  })
  @QueryFilter()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description:
      "true: only the caller's own and joined groups (needs a token). Blank means all groups.",
  })
  @Transform(({ value }) => {
    if (value === '' || value === undefined) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsOptional()
  @IsBoolean()
  joined?: boolean;
}

export class CommunityUserDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) avatar_url: string | null;
}

export class CommunityGroupResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) image_url: string | null;
  @ApiProperty({ enum: GROUP_ACCESS }) access: GroupAccess;
  @ApiProperty({ description: 'Active members, the owner included' })
  member_count: number;
  @ApiProperty({ type: CommunityUserDto }) owner: CommunityUserDto;
  @ApiProperty({
    enum: ['owner', 'member', 'pending', 'none'],
    description: "The caller's relation to the group; none without a token",
  })
  membership: Membership;
  @ApiProperty() created_at: Date;
}

export class CommunityJoinRequestDto {
  @ApiProperty({ type: CommunityUserDto }) user: CommunityUserDto;
  @ApiProperty() requested_at: Date;
}

export class CommunityMembershipDto {
  @ApiProperty({ enum: ['owner', 'member', 'pending', 'none'] })
  membership: Membership;
  @ApiProperty() member_count: number;
}
