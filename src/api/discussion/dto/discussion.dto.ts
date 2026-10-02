import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, IsUUID, Length } from 'class-validator';
import { ThreadBadge } from '../../../class/entities/discussion-thread.entity';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';

export const threadBadges = Object.values(ThreadBadge);
export const discussionRoles = ['merchant', 'mentor', 'student'] as const;
export type DiscussionRole = (typeof discussionRoles)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateThreadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  class_id: string;

  @ApiProperty({ maxLength: 160, example: 'Jadwal sesi minggu depan' })
  @Transform(trim)
  @IsString()
  @Length(1, 160)
  title: string;

  @ApiProperty({ enum: threadBadges, example: ThreadBadge.PENGUMUMAN })
  @IsIn(threadBadges)
  badge: ThreadBadge;

  @ApiProperty({ maxLength: 5000 })
  @Transform(trim)
  @IsString()
  @Length(1, 5000)
  content: string;
}

export class CreateCommentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  thread_id: string;

  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  content: string;
}

export class ThreadListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  class_id: string;

  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;
}

export class DiscussionAuthorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  avatar_url: string | null;

  @ApiProperty({ enum: discussionRoles })
  role: DiscussionRole;
}

export class DiscussionCommentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ type: DiscussionAuthorDto })
  author: DiscussionAuthorDto;
}

export class DiscussionThreadDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  class_id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: threadBadges })
  badge: ThreadBadge;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ type: DiscussionAuthorDto })
  author: DiscussionAuthorDto;

  @ApiProperty()
  comment_count: number;

  @ApiProperty({ type: [DiscussionCommentDto], description: 'Oldest first' })
  comments: DiscussionCommentDto[];
}
