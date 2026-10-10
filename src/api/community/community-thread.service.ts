import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assertOwnedAsset } from '../file-asset/asset-purpose-rules';
import {
  CatalogItemColumns,
  CatalogItemRefDto,
  loadCatalogItems,
  referenceId,
  resolveItemReferences,
} from '~/common/catalog/catalog-item';
import { paginationMeta } from '~/common/dto/response-meta.dto';
import { assetUrl } from '~/common/storage/asset-url';
import {
  createObjectStorage,
  ObjectStorage,
} from '~/common/storage/object-storage';
import { signedDownloadUrl } from '~/common/storage/signed-download-url';
import {
  assertCanRead,
  assertMember,
  authorColumns,
  authorJoins,
  findGroup,
  readableGroupCondition,
  REPLY_NOT_FOUND,
  THREAD_NOT_FOUND,
} from './community-access';
import { AuthorBadge } from './community.constants';
import {
  CommunityAuthorDto,
  CommunityLikeResponseDto,
  CommunityReplyResponseDto,
  CommunityThreadDetailDto,
  CommunityThreadFeedQueryDto,
  CommunityThreadResponseDto,
  CreateCommunityReplyDto,
  CreateCommunityThreadDto,
} from './dto/community-thread.dto';
import { CommunityGroup } from './entities/community-group.entity';
import { CommunityLike } from './entities/community-like.entity';
import { CommunityReply } from './entities/community-reply.entity';
import { CommunityThread } from './entities/community-thread.entity';

export const EMPTY_THREAD = 'A thread needs text, an attachment or an item';
export const MERCHANTS_PROMOTE = 'Only merchants can promote an item';
export const OWN_ITEM_ONLY = 'Promote a published item of your own store';
export const AUTHOR_OR_OWNER =
  'Only the author or the group owner can delete this';

interface AuthorRow {
  author_id: string;
  author_name: string;
  author_avatar_key: string | null;
  author_badge: AuthorBadge;
}

interface ThreadRow extends AuthorRow {
  id: string;
  group_id: string;
  group_name: string;
  content: string;
  attachment_name: string | null;
  attachment_size: string | null;
  attachment_key: string | null;
  class_id: string | null;
  product_id: string | null;
  bundle_id: string | null;
  like_count: number;
  liked: boolean;
  reply_count: number;
  created_at: Date;
}

interface ReplyRow extends AuthorRow {
  id: string;
  content: string;
  like_count: number;
  liked: boolean;
  created_at: Date;
}

// $1 = caller id or null.
const THREAD_SELECT = `
  SELECT thread.id, thread.group_id, g.name AS group_name, thread.content, thread.created_at,
         thread.class_id, thread.product_id, thread.bundle_id,
         attachment.original_filename AS attachment_name, attachment.size_bytes AS attachment_size,
         attachment.object_key AS attachment_key,
         (SELECT count(*)::integer FROM community_likes l
          WHERE l.thread_id = thread.id AND l.deleted_at IS NULL) AS like_count,
         EXISTS (SELECT 1 FROM community_likes l
                 WHERE l.thread_id = thread.id AND l.user_id = $1::uuid AND l.deleted_at IS NULL) AS liked,
         (SELECT count(*)::integer FROM community_replies r
          WHERE r.thread_id = thread.id AND r.deleted_at IS NULL) AS reply_count,
         ${authorColumns('author', 'author')}
  FROM community_threads thread
  INNER JOIN community_groups g ON g.id = thread.group_id AND g.deleted_at IS NULL
  INNER JOIN users author ON author.id = thread.author_user_id
  ${authorJoins('author', 'author')}
  LEFT JOIN file_assets attachment
    ON attachment.id = thread.attachment_asset_id AND attachment.deleted_at IS NULL`;

@Injectable()
export class CommunityThreadService {
  private readonly storage: ObjectStorage;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.storage = createObjectStorage(configService);
  }

  async findFeed(userId: string | null, query: CommunityThreadFeedQueryDto) {
    const { page, limit } = query;
    // One group, or every group the caller can read. `$n` is the filter's
    // own parameter; the list query also passes the caller as $1.
    let filter: (n: number) => string;
    let filterParam: string | null;
    if (query.group_id) {
      const group = await findGroup(this.dataSource.manager, query.group_id);
      await assertCanRead(this.dataSource.manager, group, userId);
      filter = (n) => `thread.group_id = $${n}`;
      filterParam = group.id;
    } else {
      filter = (n) => readableGroupCondition('g', `$${n}`);
      filterParam = userId;
    }
    const [{ total }] = await this.dataSource.query(
      `SELECT count(*)::integer AS total
       FROM community_threads thread
       INNER JOIN community_groups g ON g.id = thread.group_id AND g.deleted_at IS NULL
       WHERE thread.deleted_at IS NULL AND ${filter(1)}`,
      [filterParam],
    );
    const rows: ThreadRow[] = await this.dataSource.query(
      `${THREAD_SELECT}
       WHERE thread.deleted_at IS NULL AND ${filter(2)}
       ORDER BY thread.created_at DESC, thread.id
       LIMIT $3 OFFSET $4`,
      [userId, filterParam, limit, (page - 1) * limit],
    );
    return {
      data: await this.toThreads(rows),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get community threads success',
    };
  }

  async findOne(userId: string | null, threadId: string) {
    const thread = await this.findReadableThread(userId, threadId);
    const [row]: ThreadRow[] = await this.dataSource.query(
      `${THREAD_SELECT} WHERE thread.id = $2 AND thread.deleted_at IS NULL`,
      [userId, thread.id],
    );
    const replies: ReplyRow[] = await this.dataSource.query(
      `SELECT reply.id, reply.content, reply.created_at,
              (SELECT count(*)::integer FROM community_likes l
               WHERE l.reply_id = reply.id AND l.deleted_at IS NULL) AS like_count,
              EXISTS (SELECT 1 FROM community_likes l
                      WHERE l.reply_id = reply.id AND l.user_id = $1::uuid AND l.deleted_at IS NULL) AS liked,
              ${authorColumns('author', 'author')}
       FROM community_replies reply
       INNER JOIN users author ON author.id = reply.author_user_id
       ${authorJoins('author', 'author')}
       WHERE reply.thread_id = $2 AND reply.deleted_at IS NULL
       ORDER BY reply.created_at, reply.id`,
      [userId, thread.id],
    );
    const [response] = await this.toThreads([row]);
    const data: CommunityThreadDetailDto = {
      ...response,
      replies: replies.map((reply) => this.toReply(reply)),
    };
    return { data, responseMessage: 'Get community thread success' };
  }

  async create(userId: string, input: CreateCommunityThreadDto) {
    const threadId = await this.dataSource.transaction(async (manager) => {
      const group = await findGroup(manager, input.group_id);
      await assertMember(manager, group.id, userId);
      if (!input.content && !input.attachment_asset_id && !input.item) {
        throw new BadRequestException(EMPTY_THREAD);
      }
      const item = input.item
        ? await this.ownPublishedItem(manager, userId, input.item)
        : null;
      if (input.attachment_asset_id) {
        await assertOwnedAsset(
          manager,
          userId,
          input.attachment_asset_id,
          'community_attachment',
        );
      }
      const thread = await manager.save(
        CommunityThread,
        manager.create(CommunityThread, {
          groupId: group.id,
          authorUserId: userId,
          content: input.content ?? '',
          attachmentAssetId: input.attachment_asset_id ?? null,
          classId: item?.classId ?? null,
          productId: item?.productId ?? null,
          bundleId: item?.bundleId ?? null,
        }),
      );
      return thread.id;
    });
    const { data } = await this.findOne(userId, threadId);
    return { data, responseMessage: 'Create community thread success' };
  }

  async reply(
    userId: string,
    threadId: string,
    input: CreateCommunityReplyDto,
  ) {
    const replyId = await this.dataSource.transaction(async (manager) => {
      const thread = await manager.findOneBy(CommunityThread, { id: threadId });
      if (!thread) throw new NotFoundException(THREAD_NOT_FOUND);
      await findGroup(manager, thread.groupId);
      await assertMember(manager, thread.groupId, userId);
      const reply = await manager.save(
        CommunityReply,
        manager.create(CommunityReply, {
          threadId: thread.id,
          authorUserId: userId,
          content: input.content,
        }),
      );
      return reply.id;
    });
    const [row]: ReplyRow[] = await this.dataSource.query(
      `SELECT reply.id, reply.content, reply.created_at, 0 AS like_count, false AS liked,
              ${authorColumns('author', 'author')}
       FROM community_replies reply
       INNER JOIN users author ON author.id = reply.author_user_id
       ${authorJoins('author', 'author')}
       WHERE reply.id = $1`,
      [replyId],
    );
    return {
      data: this.toReply(row),
      responseMessage: 'Create community reply success',
    };
  }

  async setThreadLike(userId: string, threadId: string, liked: boolean) {
    const thread = await this.findReadableThread(userId, threadId);
    return this.setLike(userId, { threadId: thread.id, replyId: null }, liked);
  }

  async setReplyLike(userId: string, replyId: string, liked: boolean) {
    const reply = await this.dataSource.manager.findOneBy(CommunityReply, {
      id: replyId,
    });
    if (!reply) throw new NotFoundException(REPLY_NOT_FOUND);
    await this.findReadableThread(userId, reply.threadId);
    return this.setLike(userId, { threadId: null, replyId: reply.id }, liked);
  }

  async removeThread(userId: string, threadId: string) {
    await this.dataSource.transaction(async (manager) => {
      const thread = await manager.findOneBy(CommunityThread, { id: threadId });
      if (!thread) throw new NotFoundException(THREAD_NOT_FOUND);
      await this.assertAuthorOrOwner(
        manager,
        thread.authorUserId,
        thread.groupId,
        userId,
      );
      await manager.softDelete(CommunityThread, { id: thread.id });
    });
  }

  async removeReply(userId: string, replyId: string) {
    await this.dataSource.transaction(async (manager) => {
      const reply = await manager.findOneBy(CommunityReply, { id: replyId });
      if (!reply) throw new NotFoundException(REPLY_NOT_FOUND);
      const thread = await manager.findOneBy(CommunityThread, {
        id: reply.threadId,
      });
      if (!thread) throw new NotFoundException(REPLY_NOT_FOUND);
      await this.assertAuthorOrOwner(
        manager,
        reply.authorUserId,
        thread.groupId,
        userId,
      );
      await manager.softDelete(CommunityReply, { id: reply.id });
    });
  }

  private async setLike(
    userId: string,
    target: { threadId: string | null; replyId: string | null },
    liked: boolean,
  ): Promise<{ data: CommunityLikeResponseDto; responseMessage: string }> {
    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOneBy(CommunityLike, {
        userId,
        ...(target.threadId
          ? { threadId: target.threadId }
          : { replyId: target.replyId }),
      });
      if (liked && !existing) {
        // The unique index turns a concurrent duplicate into a no-op.
        await manager
          .createQueryBuilder()
          .insert()
          .into(CommunityLike)
          .values({ userId, ...target })
          .orIgnore()
          .execute();
      }
      if (!liked && existing) {
        await manager.softDelete(CommunityLike, { id: existing.id });
      }
    });
    const column = target.threadId ? 'thread_id' : 'reply_id';
    const [{ like_count }] = await this.dataSource.query(
      `SELECT count(*)::integer AS like_count FROM community_likes
       WHERE ${column} = $1 AND deleted_at IS NULL`,
      [target.threadId ?? target.replyId],
    );
    return {
      data: { like_count, liked },
      responseMessage: liked ? 'Like success' : 'Unlike success',
    };
  }

  private async findReadableThread(
    userId: string | null,
    threadId: string,
  ): Promise<CommunityThread> {
    const manager = this.dataSource.manager;
    const thread = await manager.findOneBy(CommunityThread, { id: threadId });
    if (!thread) throw new NotFoundException(THREAD_NOT_FOUND);
    const group = await manager.findOneBy(CommunityGroup, {
      id: thread.groupId,
    });
    if (!group) throw new NotFoundException(THREAD_NOT_FOUND);
    await assertCanRead(manager, group, userId);
    return thread;
  }

  private async assertAuthorOrOwner(
    manager: EntityManager,
    authorId: string,
    groupId: string,
    userId: string,
  ): Promise<void> {
    if (authorId === userId) return;
    const group = await manager.findOneBy(CommunityGroup, { id: groupId });
    if (group?.ownerUserId !== userId) {
      throw new ForbiddenException(AUTHOR_OR_OWNER);
    }
  }

  // Merchants promote a published item of their own store.
  private async ownPublishedItem(
    manager: EntityManager,
    userId: string,
    ref: CatalogItemRefDto,
  ): Promise<CatalogItemColumns> {
    const [merchant] = await manager.query(
      'SELECT id FROM merchants WHERE user_id = $1 AND deleted_at IS NULL',
      [userId],
    );
    if (!merchant) throw new BadRequestException(MERCHANTS_PROMOTE);
    const [columns] = await resolveItemReferences(manager, [ref]);
    const item = (await loadCatalogItems(manager, [columns])).get(ref.id);
    if (!item || item.merchant_id !== merchant.id || !item.is_available) {
      throw new BadRequestException(OWN_ITEM_ONLY);
    }
    return columns;
  }

  private async toThreads(
    rows: ThreadRow[],
  ): Promise<CommunityThreadResponseDto[]> {
    const refs = rows
      .filter((row) => row.class_id || row.product_id || row.bundle_id)
      .map((row) => ({
        classId: row.class_id,
        productId: row.product_id,
        bundleId: row.bundle_id,
      }));
    const items = await loadCatalogItems(this.dataSource.manager, refs);
    return Promise.all(
      rows.map(async (row) => {
        const ref = {
          classId: row.class_id,
          productId: row.product_id,
          bundleId: row.bundle_id,
        };
        const hasItem = Boolean(ref.classId || ref.productId || ref.bundleId);
        return {
          id: row.id,
          group: { id: row.group_id, name: row.group_name },
          author: this.toAuthor(row),
          content: row.content,
          attachment:
            row.attachment_key && row.attachment_name
              ? {
                  name: row.attachment_name,
                  size: Number(row.attachment_size),
                  download_url: await signedDownloadUrl(
                    this.storage,
                    row.attachment_key,
                    row.attachment_name,
                  ),
                }
              : null,
          item: hasItem ? (items.get(referenceId(ref)) ?? null) : null,
          like_count: row.like_count,
          liked: row.liked === true,
          reply_count: row.reply_count,
          created_at: row.created_at,
        };
      }),
    );
  }

  private toReply(row: ReplyRow): CommunityReplyResponseDto {
    return {
      id: row.id,
      author: this.toAuthor(row),
      content: row.content,
      like_count: Number(row.like_count),
      liked: row.liked === true,
      created_at: row.created_at,
    };
  }

  private toAuthor(row: AuthorRow): CommunityAuthorDto {
    return {
      id: row.author_id,
      name: row.author_name,
      avatar_url: assetUrl(row.author_avatar_key),
      badge: row.author_badge,
    };
  }
}
