import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Comment } from '../../class/entities/comment.entity';
import { DiscussionThread } from '../../class/entities/discussion-thread.entity';
import { assetUrl } from '../../common/storage/asset-url';
import {
  CreateCommentDto,
  CreateThreadDto,
  DiscussionCommentDto,
  DiscussionRole,
  DiscussionThreadDto,
  ThreadListQueryDto,
} from './dto/discussion.dto';
import { paginationMeta } from '~/common/dto/response-meta.dto';

// The caller's role in the class: the merchant owner and active assigned
// mentors run the discussion; enrolled learners take part in it.
const CLASS_ROLE_SQL = `
  SELECT
    CASE
      WHEN merchant.user_id = $2 THEN 'merchant'
      WHEN EXISTS (
        SELECT 1 FROM class_mentors link
        INNER JOIN mentors mentor
          ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
          AND mentor.status = 'active'
        WHERE link.class_id = class.id AND link.deleted_at IS NULL
          AND mentor.user_id = $2
      ) THEN 'mentor'
      WHEN EXISTS (
        SELECT 1 FROM enrollments enrollment
        WHERE enrollment.class_id = class.id AND enrollment.user_id = $2
          AND enrollment.deleted_at IS NULL
      ) THEN 'student'
    END AS role
  FROM classes class
  INNER JOIN merchants merchant
    ON merchant.id = class.merchant_id AND merchant.deleted_at IS NULL
  WHERE class.id = $1 AND class.deleted_at IS NULL
`;

const AUTHOR_COLUMNS = `
  author.id AS author_id, author.name AS author_name,
  avatar.object_key AS author_avatar_object_key
`;
const AUTHOR_JOINS = (table: string) => `
  INNER JOIN users author ON author.id = ${table}.author_id
  LEFT JOIN user_profiles author_profile
    ON author_profile.user_id = author.id AND author_profile.deleted_at IS NULL
  LEFT JOIN file_assets avatar
    ON avatar.id = author_profile.avatar_asset_id AND avatar.deleted_at IS NULL
`;

@Injectable()
export class DiscussionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findThreads(
    userId: string,
    classId: string,
    query: ThreadListQueryDto,
  ) {
    await this.requireRole(this.dataSource.manager, userId, classId);
    const { page, limit } = query;

    const [countRow] = await this.dataSource.query(
      `SELECT count(*)::integer AS total FROM discussion_threads
       WHERE class_id = $1 AND deleted_at IS NULL`,
      [classId],
    );
    const threads: ThreadRow[] = await this.dataSource.query(
      `SELECT thread.id, thread.class_id, thread.title, thread.content,
              thread.badge, thread.created_at, thread.author_role,
              ${AUTHOR_COLUMNS},
              (SELECT count(*) FROM comments comment
                 WHERE comment.thread_id = thread.id
                   AND comment.deleted_at IS NULL)::integer AS comment_count
       FROM discussion_threads thread
       ${AUTHOR_JOINS('thread')}
       WHERE thread.class_id = $1 AND thread.deleted_at IS NULL
       ORDER BY thread.created_at DESC, thread.id DESC
       LIMIT $2 OFFSET $3`,
      [classId, limit, (page - 1) * limit],
    );
    const comments = await this.findComments(
      threads.map((thread) => thread.id),
    );

    return {
      data: threads.map((thread) => ({
        ...this.toThread(thread),
        comments: comments
          .filter((comment) => comment.thread_id === thread.id)
          .map((comment) => this.toComment(comment)),
      })),
      meta: paginationMeta(page, limit, countRow.total),
      responseMessage: 'Get class threads success',
    };
  }

  async createThread(userId: string, input: CreateThreadDto) {
    const threadId = await this.dataSource.transaction(async (manager) => {
      const role = await this.requireRole(manager, userId, input.class_id);
      if (role === 'student') {
        throw new ForbiddenException(
          'Only the merchant or class mentors can start a thread',
        );
      }
      const thread = await manager.save(
        DiscussionThread,
        manager.create(DiscussionThread, {
          class_id: input.class_id,
          author_id: userId,
          author_role: role,
          title: input.title,
          content: input.content,
          badge: input.badge,
        }),
      );
      return thread.id;
    });

    const [thread] = await this.findThreadRows([threadId]);
    const data: DiscussionThreadDto = {
      ...this.toThread(thread),
      comments: [],
    };
    return { data, responseMessage: 'Create thread success' };
  }

  async createComment(userId: string, input: CreateCommentDto) {
    const commentId = await this.dataSource.transaction(async (manager) => {
      const [thread] = await manager.query(
        `SELECT class_id FROM discussion_threads
         WHERE id = $1 AND deleted_at IS NULL`,
        [input.thread_id],
      );
      if (!thread) throw new NotFoundException('Thread not found');
      const role = await this.requireRole(manager, userId, thread.class_id);
      const comment = await manager.save(
        Comment,
        manager.create(Comment, {
          thread_id: input.thread_id,
          author_id: userId,
          author_role: role,
          content: input.content,
        }),
      );
      return comment.id;
    });

    const [row] = await this.dataSource.query(
      `SELECT comment.id, comment.thread_id, comment.content,
              comment.created_at, comment.author_role, ${AUTHOR_COLUMNS}
       FROM comments comment ${AUTHOR_JOINS('comment')}
       WHERE comment.id = $1`,
      [commentId],
    );
    return {
      data: this.toComment(row),
      responseMessage: 'Create comment success',
    };
  }

  // Classes the caller has no part in are hidden behind 404.
  private async requireRole(
    manager: EntityManager,
    userId: string,
    classId: string,
  ): Promise<DiscussionRole> {
    const [row] = await manager.query(CLASS_ROLE_SQL, [classId, userId]);
    if (!row?.role) throw new NotFoundException('Class not found');
    return row.role;
  }

  private findThreadRows(ids: string[]): Promise<ThreadRow[]> {
    return this.dataSource.query(
      `SELECT thread.id, thread.class_id, thread.title, thread.content,
              thread.badge, thread.created_at, thread.author_role,
              ${AUTHOR_COLUMNS}, 0 AS comment_count
       FROM discussion_threads thread ${AUTHOR_JOINS('thread')}
       WHERE thread.id = ANY($1::uuid[])`,
      [ids],
    );
  }

  private async findComments(threadIds: string[]): Promise<CommentRow[]> {
    if (threadIds.length === 0) return [];
    return this.dataSource.query(
      `SELECT comment.id, comment.thread_id, comment.content,
              comment.created_at, comment.author_role, ${AUTHOR_COLUMNS}
       FROM comments comment ${AUTHOR_JOINS('comment')}
       WHERE comment.thread_id = ANY($1::uuid[]) AND comment.deleted_at IS NULL
       ORDER BY comment.created_at, comment.id`,
      [threadIds],
    );
  }

  private toThread(row: ThreadRow): Omit<DiscussionThreadDto, 'comments'> {
    return {
      id: row.id,
      class_id: row.class_id,
      title: row.title,
      content: row.content,
      badge: row.badge,
      created_at: row.created_at,
      author: this.toAuthor(row),
      comment_count: Number(row.comment_count),
    };
  }

  private toComment(row: CommentRow): DiscussionCommentDto {
    return {
      id: row.id,
      content: row.content,
      created_at: row.created_at,
      author: this.toAuthor(row),
    };
  }

  private toAuthor(row: AuthorRow) {
    return {
      id: row.author_id,
      name: row.author_name,
      avatar_url: assetUrl(row.author_avatar_object_key),
      role: row.author_role,
    };
  }
}

interface AuthorRow {
  author_id: string;
  author_name: string;
  author_avatar_object_key: string | null;
  author_role: DiscussionRole;
}

interface ThreadRow extends AuthorRow {
  id: string;
  class_id: string;
  title: string;
  content: string;
  badge: DiscussionThreadDto['badge'];
  created_at: Date;
  comment_count: number | string;
}

interface CommentRow extends AuthorRow {
  id: string;
  thread_id: string;
  content: string;
  created_at: Date;
}
