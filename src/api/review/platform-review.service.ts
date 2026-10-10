import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { paginationMeta } from '~/common/dto/response-meta.dto';
import { assetUrl } from '~/common/storage/asset-url';
import { Merchant } from '../merchant/entities/merchant.entity';
import {
  PlatformReviewListDto,
  PlatformReviewResponseDto,
  SavePlatformReviewDto,
} from './dto/platform-review.dto';
import { ReviewListQueryDto } from './dto/review.dto';
import { PlatformReview } from './entities/platform-review.entity';

export const MERCHANT_NOT_FOUND = 'Merchant not found';
export const MERCHANT_NOT_ACTIVE = 'Merchant is not active';

// Reviews of active, non-deleted stores; the list and its average share them.
const LISTED_REVIEWS_FROM = `
  FROM platform_reviews review
  INNER JOIN merchants merchant
    ON merchant.id = review.merchant_id AND merchant.deleted_at IS NULL AND merchant.status = 'active'`;
const LISTED_REVIEWS_WHERE = 'WHERE review.deleted_at IS NULL';

interface PublicReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  updated_at: Date;
  store_name: string;
  slug: string | null;
  logo_object_key: string | null;
}

@Injectable()
export class PlatformReviewService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findOwn(userId: string) {
    const merchant = await this.findOwnMerchant(
      this.dataSource.manager,
      userId,
    );
    const review = await this.dataSource.manager.findOneBy(PlatformReview, {
      merchantId: merchant.id,
    });
    return {
      data: review ? this.toOwnResponse(review) : null,
      responseMessage: 'Get platform review success',
    };
  }

  /** Creates the store's review or replaces its rating and comment. */
  async save(userId: string, input: SavePlatformReviewDto) {
    const { review, created } = await this.dataSource.transaction(
      async (manager) => {
        const merchant = await this.findOwnMerchant(manager, userId, true);
        // The store row lock orders concurrent saves, so a store keeps one review.
        await manager.query(
          'SELECT id FROM merchants WHERE id = $1 FOR UPDATE',
          [merchant.id],
        );
        const existing = await manager.findOneBy(PlatformReview, {
          merchantId: merchant.id,
        });
        const review =
          existing ??
          manager.create(PlatformReview, { merchantId: merchant.id });
        review.userId = userId;
        review.rating = input.rating;
        review.comment = input.comment ?? null;
        return {
          review: await manager.save(PlatformReview, review),
          created: !existing,
        };
      },
    );
    return {
      created,
      data: this.toOwnResponse(review),
      responseMessage: 'Save platform review success',
    };
  }

  async findPublic(query: ReviewListQueryDto) {
    const { page, limit } = query;
    const [summary] = await this.dataSource.query(
      `SELECT COALESCE(round(avg(review.rating)::numeric, 1), 0) AS average,
              count(review.id)::integer AS total
       ${LISTED_REVIEWS_FROM}
       ${LISTED_REVIEWS_WHERE}`,
    );
    const rows: PublicReviewRow[] = await this.dataSource.query(
      `SELECT review.id, review.rating, review.comment, review.updated_at,
              merchant.store_name, profile.slug, logo.object_key AS logo_object_key
       ${LISTED_REVIEWS_FROM}
       LEFT JOIN merchant_profiles profile
         ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
       LEFT JOIN file_assets logo
         ON logo.id = profile.avatar_asset_id AND logo.deleted_at IS NULL
       ${LISTED_REVIEWS_WHERE}
       ORDER BY review.updated_at DESC, review.id
       LIMIT $1 OFFSET $2`,
      [limit, (page - 1) * limit],
    );
    const data: PlatformReviewListDto = {
      average_rating: Number(summary.average),
      review_count: summary.total,
      reviews: rows.map((row) => ({
        id: row.id,
        rating: Number(row.rating),
        comment: row.comment,
        updated_at: row.updated_at,
        store: {
          name: row.store_name,
          slug: row.slug,
          logo_url: assetUrl(row.logo_object_key),
        },
      })),
    };
    return {
      data,
      meta: paginationMeta(page, limit, summary.total),
      responseMessage: 'Get platform reviews success',
    };
  }

  private async findOwnMerchant(
    manager: EntityManager,
    userId: string,
    requireActive = false,
  ): Promise<Merchant> {
    const merchant = await manager.findOne(Merchant, { where: { userId } });
    if (!merchant) throw new NotFoundException(MERCHANT_NOT_FOUND);
    if (requireActive && merchant.status !== 'active') {
      throw new ForbiddenException(MERCHANT_NOT_ACTIVE);
    }
    return merchant;
  }

  private toOwnResponse(review: PlatformReview): PlatformReviewResponseDto {
    return {
      rating: Number(review.rating),
      comment: review.comment,
      created_at: review.created_at,
      updated_at: review.updated_at,
    };
  }
}
