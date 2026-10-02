import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { ThreadBadge } from '../../../class/entities/discussion-thread.entity';
import { EnumInput, RequiredText } from '~/common/decorator/input.decorator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';

export const threadBadges = Object.values(ThreadBadge);
export const discussionRoles = ['merchant', 'mentor', 'student'] as const;
export type DiscussionRole = (typeof discussionRoles)[number];

export class CreateThreadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  class_id: string;

  @RequiredText({ max: 160, example: 'Jadwal sesi minggu depan' })
  title: string;

  @EnumInput(threadBadges, {
    presence: 'optional',
    example: ThreadBadge.PENGUMUMAN,
    default: ThreadBadge.TANYA_JAWAB,
  })
  badge?: ThreadBadge;

  @RequiredText({ max: 5000 })
  content: string;
}

export class CreateCommentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  thread_id: string;

  @RequiredText({ max: 2000 })
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
