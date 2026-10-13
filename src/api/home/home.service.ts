import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assetUrl } from '../../common/storage/asset-url';
import { CatalogService } from '../catalog/catalog.service';
import { catalogSort } from '../catalog/dto/catalog.dto';
import { Product } from '../profile/entities/product.entity';
import {
  HomeMerchantCardResponseDto,
  HomeStatisticsResponseDto,
  HomeTestimonialResponseDto,
} from './dto/home-response.dto';

@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    private readonly catalogService: CatalogService,
  ) {}

  async getStatistics() {
    return {
      data: await this.getStatisticsProjection(),
      responseMessage: 'Get home statistics success',
    };
  }

  async getBootcamps(limit: number, viewerId?: string) {
    const cards = await this.catalogService.findCards(
      { types: ['bootcamp'] },
      catalogSort('created_at'),
      limit,
    );
    return {
      data: await this.catalogService.withViewerFlags(viewerId, cards),
      responseMessage: 'Get bootcamps success',
    };
  }

  async getVideoClasses(limit: number, viewerId?: string) {
    const cards = await this.catalogService.findCards(
      { types: ['kelas'] },
      catalogSort('created_at'),
      limit,
    );
    return {
      data: await this.catalogService.withViewerFlags(viewerId, cards),
      responseMessage: 'Get video classes success',
    };
  }

  async getDigitalProducts(limit: number, viewerId?: string) {
    const cards = await this.catalogService.findCards(
      { types: ['digital'] },
      catalogSort('created_at'),
      limit,
    );
    return {
      data: await this.catalogService.withViewerFlags(viewerId, cards),
      responseMessage: 'Get digital products success',
    };
  }

  async getMerchants(limit: number) {
    return {
      data: await this.getMerchantCards(limit),
      responseMessage: 'Get merchants success',
    };
  }

  async getTestimonials(limit: number) {
    return {
      data: await this.getTestimonialCards(limit),
      responseMessage: 'Get testimonials success',
    };
  }

  // The item counts match the public catalog, so items of an inactive or
  // deleted merchant are left out. Learners count while their account exists,
  // including buyers of such a merchant, who keep access. The rating keeps
  // every review, like the review lists.
  private async getStatisticsProjection(): Promise<HomeStatisticsResponseDto> {
    const [row] = (await this.products.query(`
      SELECT
        (
          SELECT COUNT(DISTINCT learner.user_id)::integer
          FROM (
            SELECT user_id FROM enrollments WHERE deleted_at IS NULL
            UNION
            SELECT user_id FROM user_access
            WHERE deleted_at IS NULL AND (expires_at IS NULL OR expires_at > now())
          ) learner
          INNER JOIN users learner_user
            ON learner_user.id = learner.user_id AND learner_user.deleted_at IS NULL
        ) AS active_students,
        (
          SELECT COUNT(*)::integer FROM classes class
          INNER JOIN merchants merchant
            ON merchant.id = class.merchant_id
            AND merchant.deleted_at IS NULL AND merchant.status = 'active'
          WHERE class.status = 'published' AND class.deleted_at IS NULL
        ) AS learning_products,
        (
          SELECT COUNT(*)::integer FROM products product
          INNER JOIN merchants merchant
            ON merchant.id = product.merchant_id
            AND merchant.deleted_at IS NULL AND merchant.status = 'active'
          WHERE product.deleted_at IS NULL AND product.is_published = true
            AND product.publication_status = 'published'
        ) AS digital_products,
        (
          SELECT COALESCE(ROUND(AVG(review.rating)::numeric, 1), 0)
          FROM reviews review
          WHERE review.deleted_at IS NULL
        ) AS platform_rating
    `)) as StatisticsRow[];

    return {
      active_students: Number(row.active_students),
      learning_products: Number(row.learning_products),
      digital_products: Number(row.digital_products),
      platform_rating: Number(row.platform_rating),
    };
  }

  private async getMerchantCards(
    limit: number,
  ): Promise<HomeMerchantCardResponseDto[]> {
    const rows = (await this.products.query(
      `
        SELECT
          merchant.id,
          merchant.store_name AS name,
          merchant_profile.slug,
          merchant_avatar.object_key AS avatar_object_key,
          latest_product.title AS best_product_title,
          latest_product_cover.object_key AS best_product_cover_object_key,
          latest_product.rating AS best_product_rating
        FROM merchants merchant
        LEFT JOIN merchant_profiles merchant_profile
          ON merchant_profile.merchant_id = merchant.id
          AND merchant_profile.deleted_at IS NULL
        LEFT JOIN file_assets merchant_avatar
          ON merchant_avatar.id = merchant_profile.avatar_asset_id
          AND merchant_avatar.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT
            product.title,
            product.cover_asset_id,
            COALESCE(ROUND(AVG(review.rating)::numeric, 1), 0) AS rating
          FROM products product
          LEFT JOIN reviews review
            ON review.product_id = product.id AND review.deleted_at IS NULL
          WHERE product.merchant_id = merchant.id
            AND product.deleted_at IS NULL
            AND product.is_published = true
            AND product.publication_status = 'published'
          GROUP BY product.id
          ORDER BY COALESCE(product.published_at, product.created_at) DESC
          LIMIT 1
        ) latest_product ON true
        LEFT JOIN file_assets latest_product_cover
          ON latest_product_cover.id = latest_product.cover_asset_id
          AND latest_product_cover.deleted_at IS NULL
        WHERE merchant.deleted_at IS NULL
          AND merchant.status = 'active'
        ORDER BY merchant.created_at DESC
        LIMIT $1
      `,
      [limit],
    )) as MerchantCardRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      avatar_url: assetUrl(row.avatar_object_key),
      best_product_title: row.best_product_title,
      best_product_cover_url: assetUrl(row.best_product_cover_object_key),
      best_product_rating:
        row.best_product_rating === null
          ? null
          : Number(row.best_product_rating),
    }));
  }

  // Testimonials are well-rated class reviews with a written comment, on
  // classes of active merchants, since the card links to the class page. Like
  // every review list, they keep reviews of deleted accounts.
  private async getTestimonialCards(
    limit: number,
  ): Promise<HomeTestimonialResponseDto[]> {
    const rows = (await this.products.query(
      `
        SELECT
          review.id,
          review.rating,
          review.comment,
          review.created_at,
          reviewer.name AS user_name,
          reviewer_avatar.object_key AS user_avatar_object_key,
          class.id AS class_id,
          class.title AS class_title
        FROM reviews review
        INNER JOIN users reviewer ON reviewer.id = review.user_id
        INNER JOIN classes class
          ON class.id = review.class_id AND class.deleted_at IS NULL
        INNER JOIN merchants merchant
          ON merchant.id = class.merchant_id
          AND merchant.deleted_at IS NULL AND merchant.status = 'active'
        LEFT JOIN user_profiles reviewer_profile
          ON reviewer_profile.user_id = reviewer.id
          AND reviewer_profile.deleted_at IS NULL
        LEFT JOIN file_assets reviewer_avatar
          ON reviewer_avatar.id = reviewer_profile.avatar_asset_id
          AND reviewer_avatar.deleted_at IS NULL
        WHERE review.deleted_at IS NULL
          AND review.rating >= 4
          AND NULLIF(BTRIM(review.comment), '') IS NOT NULL
          AND class.status = 'published'
        ORDER BY review.created_at DESC, review.id DESC
        LIMIT $1
      `,
      [limit],
    )) as TestimonialRow[];

    return rows.map((row) => ({
      id: row.id,
      rating: Number(row.rating),
      comment: row.comment,
      created_at: row.created_at,
      user_name: row.user_name,
      user_avatar_url: assetUrl(row.user_avatar_object_key),
      class_id: row.class_id,
      class_title: row.class_title,
    }));
  }
}

interface StatisticsRow {
  active_students: string;
  learning_products: string;
  digital_products: string;
  platform_rating: string;
}

interface MerchantCardRow {
  id: string;
  name: string;
  slug: string | null;
  avatar_object_key: string | null;
  best_product_title: string | null;
  best_product_cover_object_key: string | null;
  best_product_rating: string | null;
}

interface TestimonialRow {
  id: string;
  rating: string;
  comment: string;
  created_at: Date;
  user_name: string;
  user_avatar_object_key: string | null;
  class_id: string;
  class_title: string;
}
