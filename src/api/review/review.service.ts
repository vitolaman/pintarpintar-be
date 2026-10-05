import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { assetUrl } from '../../common/storage/asset-url';
import { classKindSql } from '../../common/catalog/item-kind';
import {
  CreateReviewDto,
  CreateReviewReplyDto,
  ItemReviewDto,
  MerchantReviewResponseDto,
  ReviewListQueryDto,
  ReviewReplyDto,
  ReviewResponseDto,
} from './dto/review.dto';
import { ReviewHelpfulVote } from './entities/review-helpful-vote.entity';
import { ReviewReply, ReviewReplyRole } from './entities/review-reply.entity';
import { Review } from './entities/review.entity';
import { paginationMeta } from '~/common/dto/response-meta.dto';

const UNIQUE_VIOLATION = '23505';

const REVIEW_COLUMNS = `
  review.id, review.rating, review.comment, review.created_at,
  reviewer.name AS reviewer_name, avatar.object_key AS reviewer_avatar_object_key
`;
const REVIEW_FROM = `
  FROM reviews review
  INNER JOIN users reviewer ON reviewer.id = review.user_id
  LEFT JOIN user_profiles profile ON profile.user_id = reviewer.id AND profile.deleted_at IS NULL
  LEFT JOIN file_assets avatar ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
`;
const REVIEW_ROWS_SQL = `SELECT ${REVIEW_COLUMNS} ${REVIEW_FROM}`;

// A page of an item's reviews ($1 = item id, $2 limit, $3 offset) with their
// helpful marks; $4 is the caller, or null for a visitor without a token.
const ITEM_REVIEW_ROWS_SQL = (itemColumn: 'class_id' | 'product_id') => `
  SELECT ${REVIEW_COLUMNS},
         (SELECT count(*)::integer FROM review_helpful_votes vote
          WHERE vote.review_id = review.id) AS helpful_count,
         EXISTS (
           SELECT 1 FROM review_helpful_votes vote
           WHERE vote.review_id = review.id AND vote.user_id = $4
         ) AS viewer_has_voted,
         COALESCE(review.user_id = $4, false) AS is_own_review
  ${REVIEW_FROM}
  WHERE review.${itemColumn} = $1 AND review.deleted_at IS NULL
  ORDER BY review.created_at DESC, review.id DESC
  LIMIT $2 OFFSET $3
`;

// The user's relation to a reviewed class or product, which decides whether
// they may reply: the merchant owner first, then an active assigned mentor
// (classes only), then an enrolled learner or a buyer with unexpired access.
// Null when there is none, or when the user is null.
function itemRelationSql(classId: string, productId: string, userId: string) {
  return `
    CASE
      WHEN EXISTS (
        SELECT 1 FROM merchants merchant
        WHERE merchant.user_id = ${userId} AND merchant.deleted_at IS NULL
          AND merchant.id IN (
            SELECT merchant_id FROM classes WHERE id = ${classId}
            UNION ALL
            SELECT merchant_id FROM products WHERE id = ${productId}
          )
      ) THEN 'merchant'
      WHEN EXISTS (
        SELECT 1 FROM class_mentors link
        INNER JOIN mentors mentor
          ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
          AND mentor.status = 'active'
        WHERE link.class_id = ${classId} AND link.deleted_at IS NULL
          AND mentor.user_id = ${userId}
      ) THEN 'mentor'
      WHEN EXISTS (
        SELECT 1 FROM enrollments enrollment
        WHERE enrollment.class_id = ${classId} AND enrollment.user_id = ${userId}
          AND enrollment.deleted_at IS NULL
      ) THEN 'buyer'
      WHEN EXISTS (
        SELECT 1 FROM user_access access
        WHERE access.product_id = ${productId} AND access.user_id = ${userId}
          AND access.deleted_at IS NULL
          AND (access.expires_at IS NULL OR access.expires_at > now())
      ) THEN 'buyer'
    END
  `;
}

// A review shown in a list: not deleted, of a non-deleted class or a
// published digital product. $1 = review id.
const VISIBLE_REVIEW_FROM = `
  FROM reviews review
  LEFT JOIN classes class ON class.id = review.class_id AND class.deleted_at IS NULL
  LEFT JOIN products product ON product.id = review.product_id
    AND product.deleted_at IS NULL AND product.is_published = true
    AND product.publication_status = 'published'
  WHERE review.id = $1 AND review.deleted_at IS NULL
    AND (class.id IS NOT NULL OR product.id IS NOT NULL)
`;

const REPLY_ROWS_SQL = `
  SELECT reply.id, reply.review_id, reply.comment, reply.created_at,
         reply.author_role, author.name AS author_name,
         avatar.object_key AS author_avatar_object_key
  FROM review_replies reply
  INNER JOIN users author ON author.id = reply.author_id
  LEFT JOIN user_profiles profile ON profile.user_id = author.id AND profile.deleted_at IS NULL
  LEFT JOIN file_assets avatar ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
`;

// Visible reviews ($1 = merchant id) of the merchant's published classes and
// products, with the reviewer.
const MERCHANT_REVIEWS_SQL = `
  FROM reviews review
  INNER JOIN users reviewer ON reviewer.id = review.user_id
  LEFT JOIN user_profiles profile
    ON profile.user_id = reviewer.id AND profile.deleted_at IS NULL
  LEFT JOIN file_assets avatar
    ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
  LEFT JOIN classes class ON class.id = review.class_id
    AND class.deleted_at IS NULL AND class.status = 'published'
  LEFT JOIN products product ON product.id = review.product_id
    AND product.deleted_at IS NULL AND product.is_published = true
    AND product.publication_status = 'published'
  WHERE review.deleted_at IS NULL
    AND (class.merchant_id = $1 OR product.merchant_id = $1)
`;

@Injectable()
export class ReviewService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(userId: string, input: CreateReviewDto) {
    if (input.class_id && input.product_id) {
      throw new BadRequestException('Review either a class or a product');
    }
    if (input.product_id) return this.createProductReview(userId, input);
    try {
      const review = await this.dataSource.transaction(async (manager) => {
        const [target] = await manager.query(
          `SELECT class.id,
                  EXISTS (
                    SELECT 1 FROM enrollments enrollment
                    WHERE enrollment.class_id = class.id AND enrollment.user_id = $2
                      AND enrollment.deleted_at IS NULL
                  ) AS enrolled,
                  EXISTS (
                    SELECT 1 FROM reviews review
                    WHERE review.class_id = class.id AND review.user_id = $2
                      AND review.deleted_at IS NULL
                  ) AS reviewed
           FROM classes class WHERE class.id = $1 AND class.deleted_at IS NULL`,
          [input.class_id, userId],
        );
        if (!target) throw new NotFoundException('Class not found');
        if (!target.enrolled) {
          throw new ForbiddenException('Only enrolled learners can review');
        }
        if (target.reviewed) {
          throw new ConflictException('You have already reviewed this class');
        }

        return manager.save(
          Review,
          manager.create(Review, {
            userId,
            classId: input.class_id,
            productId: null,
            orderId: null,
            rating: input.rating,
            comment: input.comment || null,
          }),
        );
      });

      const [row] = await this.dataSource.query(
        `${REVIEW_ROWS_SQL} WHERE review.id = $1`,
        [review.id],
      );
      return { data: toReview(row), responseMessage: 'Create review success' };
    } catch (error) {
      // A concurrent second review of the same class loses on the unique index.
      if (
        error instanceof QueryFailedError &&
        (error as unknown as { code: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('You have already reviewed this class');
      }
      throw error;
    }
  }

  // Buyers with active access review a digital product once.
  private async createProductReview(userId: string, input: CreateReviewDto) {
    try {
      const review = await this.dataSource.transaction(async (manager) => {
        const [target] = await manager.query(
          `SELECT product.id,
                  EXISTS (
                    SELECT 1 FROM user_access access
                    WHERE access.product_id = product.id AND access.user_id = $2
                      AND access.deleted_at IS NULL
                      AND (access.expires_at IS NULL OR access.expires_at > now())
                  ) AS owned,
                  EXISTS (
                    SELECT 1 FROM reviews review
                    WHERE review.product_id = product.id AND review.user_id = $2
                      AND review.deleted_at IS NULL
                  ) AS reviewed
           FROM products product
           WHERE product.id = $1 AND product.deleted_at IS NULL`,
          [input.product_id, userId],
        );
        if (!target) throw new NotFoundException('Digital product not found');
        if (!target.owned) {
          throw new ForbiddenException('Only buyers can review this product');
        }
        if (target.reviewed) {
          throw new ConflictException('You have already reviewed this product');
        }
        return manager.save(
          Review,
          manager.create(Review, {
            userId,
            classId: null,
            productId: input.product_id,
            orderId: null,
            rating: input.rating,
            comment: input.comment || null,
          }),
        );
      });

      const [row] = await this.dataSource.query(
        `${REVIEW_ROWS_SQL} WHERE review.id = $1`,
        [review.id],
      );
      return { data: toReview(row), responseMessage: 'Create review success' };
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as unknown as { code: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('You have already reviewed this product');
      }
      throw error;
    }
  }

  // Reviews of a published digital product, newest first.
  async findProductReviews(
    productId: string,
    query: ReviewListQueryDto,
    viewerId?: string,
  ) {
    const [summary] = await this.dataSource.query(
      `SELECT EXISTS (
                SELECT 1 FROM products
                WHERE id = $1 AND deleted_at IS NULL AND is_published = true
                  AND publication_status = 'published') AS found,
              COALESCE(round(avg(review.rating)::numeric, 1), 0) AS average,
              count(review.id)::integer AS total,
              (${itemRelationSql('NULL::uuid', '$1::uuid', '$2::uuid')}) IS NOT NULL AS viewer_can_reply
       FROM reviews review
       WHERE review.product_id = $1 AND review.deleted_at IS NULL`,
      [productId, viewerId ?? null],
    );
    if (!summary.found)
      throw new NotFoundException('Digital product not found');

    const { page, limit } = query;
    const reviews = await this.itemReviews(
      'product_id',
      productId,
      query,
      viewerId,
    );
    return {
      data: {
        average_rating: Number(summary.average),
        review_count: summary.total,
        viewer_can_reply: summary.viewer_can_reply === true,
        reviews,
      },
      meta: paginationMeta(page, limit, summary.total),
      responseMessage: 'Get product reviews success',
    };
  }

  async findClassReviews(
    classId: string,
    query: ReviewListQueryDto,
    viewerId?: string,
  ) {
    const [summary] = await this.dataSource.query(
      `SELECT EXISTS (SELECT 1 FROM classes WHERE id = $1 AND deleted_at IS NULL) AS found,
              COALESCE(round(avg(review.rating)::numeric, 1), 0) AS average,
              count(review.id)::integer AS total,
              (${itemRelationSql('$1::uuid', 'NULL::uuid', '$2::uuid')}) IS NOT NULL AS viewer_can_reply
       FROM reviews review
       WHERE review.class_id = $1 AND review.deleted_at IS NULL`,
      [classId, viewerId ?? null],
    );
    if (!summary.found) throw new NotFoundException('Class not found');

    const { page, limit } = query;
    const reviews = await this.itemReviews(
      'class_id',
      classId,
      query,
      viewerId,
    );

    return {
      data: {
        average_rating: Number(summary.average),
        review_count: summary.total,
        viewer_can_reply: summary.viewer_can_reply === true,
        reviews,
      },
      meta: paginationMeta(page, limit, summary.total),
      responseMessage: 'Get class reviews success',
    };
  }

  // One "Membantu" mark per user and review; marking again changes nothing.
  async markHelpful(userId: string, reviewId: string) {
    const review = await this.findVisibleReview(reviewId);
    if (review.user_id === userId) {
      throw new ForbiddenException(
        'You cannot mark your own review as helpful',
      );
    }
    // Concurrent marks by one user resolve on the unique (review, user) index.
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(ReviewHelpfulVote)
      .values({ reviewId, userId })
      .orIgnore()
      .execute();
    return {
      data: await this.helpfulState(reviewId, userId),
      responseMessage: 'Mark review helpful success',
    };
  }

  async unmarkHelpful(userId: string, reviewId: string) {
    await this.findVisibleReview(reviewId);
    await this.dataSource.manager.delete(ReviewHelpfulVote, {
      reviewId,
      userId,
    });
    return {
      data: await this.helpfulState(reviewId, userId),
      responseMessage: 'Unmark review helpful success',
    };
  }

  // Learners or buyers of the reviewed item, its merchant owner and its class
  // mentors reply; the reply keeps the role the author has now.
  async reply(userId: string, reviewId: string, input: CreateReviewReplyDto) {
    const [target] = await this.dataSource.query(
      `SELECT review.id,
              ${itemRelationSql('review.class_id', 'review.product_id', '$2::uuid')} AS relation
       ${VISIBLE_REVIEW_FROM}`,
      [reviewId, userId],
    );
    if (!target) throw new NotFoundException('Review not found');
    if (!target.relation) {
      throw new ForbiddenException(
        'Only buyers, the merchant and the class mentors can reply',
      );
    }

    const reply = await this.dataSource.manager.save(
      ReviewReply,
      this.dataSource.manager.create(ReviewReply, {
        reviewId,
        authorId: userId,
        authorRole: target.relation as ReviewReplyRole,
        comment: input.comment,
      }),
    );
    const [row] = await this.dataSource.query(
      `${REPLY_ROWS_SQL} WHERE reply.id = $1`,
      [reply.id],
    );
    return {
      data: toReply(row),
      responseMessage: 'Create review reply success',
    };
  }

  private async findVisibleReview(
    reviewId: string,
  ): Promise<{ id: string; user_id: string }> {
    const [review] = await this.dataSource.query(
      `SELECT review.id, review.user_id ${VISIBLE_REVIEW_FROM}`,
      [reviewId],
    );
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  private async helpfulState(reviewId: string, userId: string) {
    const [state] = await this.dataSource.query(
      `SELECT count(*)::integer AS helpful_count,
              COALESCE(bool_or(user_id = $2), false) AS viewer_has_voted
       FROM review_helpful_votes WHERE review_id = $1`,
      [reviewId, userId],
    );
    return {
      helpful_count: Number(state.helpful_count),
      viewer_has_voted: state.viewer_has_voted === true,
    };
  }

  // A page of a class's or product's reviews with marks and replies: one query
  // for the page and one for all of its replies.
  private async itemReviews(
    itemColumn: 'class_id' | 'product_id',
    itemId: string,
    { page, limit }: ReviewListQueryDto,
    viewerId?: string,
  ): Promise<ItemReviewDto[]> {
    const rows = await this.dataSource.query(ITEM_REVIEW_ROWS_SQL(itemColumn), [
      itemId,
      limit,
      (page - 1) * limit,
      viewerId ?? null,
    ]);
    if (rows.length === 0) return [];

    const replyRows = await this.dataSource.query(
      `${REPLY_ROWS_SQL}
       WHERE reply.review_id = ANY($1::uuid[]) AND reply.deleted_at IS NULL
       ORDER BY reply.created_at, reply.id`,
      [rows.map((row) => row.id)],
    );
    const repliesByReview = new Map<string, ReviewReplyDto[]>();
    for (const replyRow of replyRows) {
      const replies = repliesByReview.get(replyRow.review_id) ?? [];
      replies.push(toReply(replyRow));
      repliesByReview.set(replyRow.review_id, replies);
    }

    return rows.map((row) => ({
      ...toReview(row),
      helpful_count: Number(row.helpful_count),
      viewer_has_voted: row.viewer_has_voted === true,
      is_own_review: row.is_own_review === true,
      replies: repliesByReview.get(row.id) ?? [],
    }));
  }

  // Reviews of the merchant's published classes and products (Review tab).
  async findMerchantReviews(merchantId: string, query: ReviewListQueryDto) {
    const [summary] = await this.dataSource.query(
      `SELECT EXISTS (
                SELECT 1 FROM merchants
                WHERE id = $1 AND deleted_at IS NULL AND status = 'active'
              ) AS found,
              COALESCE(round(avg(review.rating)::numeric, 1), 0) AS average,
              count(review.id)::integer AS total
       ${MERCHANT_REVIEWS_SQL}`,
      [merchantId],
    );
    if (!summary.found) throw new NotFoundException('Merchant not found');

    const { page, limit } = query;
    const rows = await this.dataSource.query(
      `SELECT review.id, review.rating, review.comment, review.created_at,
              reviewer.name AS reviewer_name,
              avatar.object_key AS reviewer_avatar_object_key,
              COALESCE(class.id, product.id) AS item_id,
              CASE WHEN class.id IS NULL THEN 'digital'
                   ELSE ${classKindSql('class.type')} END AS item_type,
              COALESCE(class.title, product.title) AS item_title
       ${MERCHANT_REVIEWS_SQL}
       ORDER BY review.created_at DESC, review.id DESC
       LIMIT $2 OFFSET $3`,
      [merchantId, limit, (page - 1) * limit],
    );

    const reviews: MerchantReviewResponseDto[] = rows.map((row) => ({
      ...toReview(row),
      item: { id: row.item_id, type: row.item_type, title: row.item_title },
    }));
    return {
      data: {
        average_rating: Number(summary.average),
        review_count: summary.total,
        reviews,
      },
      meta: paginationMeta(page, limit, summary.total),
      responseMessage: 'Get merchant reviews success',
    };
  }
}

function toReview(row): ReviewResponseDto {
  return {
    id: row.id,
    rating: Number(row.rating),
    comment: row.comment,
    created_at: row.created_at,
    reviewer_name: row.reviewer_name,
    reviewer_avatar_url: assetUrl(row.reviewer_avatar_object_key),
  };
}

function toReply(row): ReviewReplyDto {
  return {
    id: row.id,
    comment: row.comment,
    created_at: row.created_at,
    author_name: row.author_name,
    author_avatar_url: assetUrl(row.author_avatar_object_key),
    author_role: row.author_role,
  };
}
