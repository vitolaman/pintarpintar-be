import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsUUID, ValidateNested } from 'class-validator';
import {
  CatalogItemDetailsDto,
  CatalogItemRefDto,
} from '~/common/catalog/catalog-item';
import {
  ClearableText,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import { assetFieldDescription } from '~/api/file-asset/asset-purpose-rules';
import {
  AUTHOR_BADGES,
  AuthorBadge,
  MAX_REPLY_CONTENT,
  MAX_THREAD_CONTENT,
} from '../community.constants';

export class CommunityThreadFeedQueryDto extends RequestPaginatedQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'One group; omit for every group the caller can read',
  })
  @IsOptional()
  @IsUUID()
  group_id?: string;
}

export class CreateCommunityThreadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  group_id: string;

  @ClearableText({
    max: MAX_THREAD_CONTENT,
    description:
      'The text; may be omitted when an attachment or item is sent (a thread needs at least one of the three)',
  })
  content?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: assetFieldDescription('community_attachment', 'Lampirkan.'),
  })
  @IsOptional()
  @IsUUID()
  attachment_asset_id?: string;

  @ApiPropertyOptional({
    type: CatalogItemRefDto,
    description:
      'Promosikan Produk: a published item of the store the caller owns (merchants only)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CatalogItemRefDto)
  item?: CatalogItemRefDto;
}

export class CreateCommunityReplyDto {
  @RequiredText({ max: MAX_REPLY_CONTENT, example: 'Coba jalankan PURGE.' })
  content: string;
}

export class CommunityAuthorDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) avatar_url: string | null;
  @ApiProperty({
    enum: AUTHOR_BADGES,
    description:
      'Merchant when the author has a store, else Mentor, else Siswa',
  })
  badge: AuthorBadge;
}

export class CommunityAttachmentDto {
  @ApiProperty() name: string;
  @ApiProperty({ description: 'Bytes' }) size: number;
  @ApiProperty({ description: 'Signed link, valid 10 minutes' })
  download_url: string;
}

export class CommunityGroupRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
}

export class CommunityReplyResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: CommunityAuthorDto }) author: CommunityAuthorDto;
  @ApiProperty() content: string;
  @ApiProperty() like_count: number;
  @ApiProperty({
    description: 'Whether the caller liked it; false without a token',
  })
  liked: boolean;
  @ApiProperty() created_at: Date;
}

export class CommunityThreadResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: CommunityGroupRefDto }) group: CommunityGroupRefDto;
  @ApiProperty({ type: CommunityAuthorDto }) author: CommunityAuthorDto;
  @ApiProperty({
    description: 'Empty when the thread is only an attachment or item',
  })
  content: string;
  @ApiPropertyOptional({ type: CommunityAttachmentDto, nullable: true })
  attachment: CommunityAttachmentDto | null;
  @ApiPropertyOptional({
    type: CatalogItemDetailsDto,
    nullable: true,
    description:
      'The promoted item; is_available false once it is no longer sold',
  })
  item: CatalogItemDetailsDto | null;
  @ApiProperty() like_count: number;
  @ApiProperty({
    description: 'Whether the caller liked it; false without a token',
  })
  liked: boolean;
  @ApiProperty() reply_count: number;
  @ApiProperty() created_at: Date;
}

export class CommunityThreadDetailDto extends CommunityThreadResponseDto {
  @ApiProperty({
    type: [CommunityReplyResponseDto],
    description: 'Oldest first',
  })
  replies: CommunityReplyResponseDto[];
}

export class CommunityLikeResponseDto {
  @ApiProperty() like_count: number;
  @ApiProperty() liked: boolean;
}
