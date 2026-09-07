import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../profile/entities/product.entity';
import {
  HomeMerchantCardResponseDto,
  HomeProductCardResponseDto,
  HomeStatisticsResponseDto,
  HomeTestimonialResponseDto,
} from './dto/home-response.dto';

@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  async getStatistics() {
    return {
      data: await this.getStatisticsProjection(),
      responseMessage: 'Get home statistics success',
    };
  }

  async getBootcamps(limit: number) {
    return {
      data: await this.getProductCards('bootcamps', limit),
      responseMessage: 'Get bootcamps success',
    };
  }

  async getVideoClasses(limit: number) {
    return {
      data: await this.getProductCards('video_classes', limit),
      responseMessage: 'Get video classes success',
    };
  }

  async getDigitalProducts(limit: number) {
    return {
      data: await this.getProductCards('digital_files', limit),
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

  private async getStatisticsProjection(): Promise<HomeStatisticsResponseDto> {
    const [row] = (await this.products.query(`
      SELECT
        (
          SELECT COUNT(DISTINCT access.user_id)::integer
          FROM user_access access
          WHERE access.deleted_at IS NULL
            AND (access.expires_at IS NULL OR access.expires_at > now())
        ) AS active_students,
        (
          SELECT COUNT(DISTINCT product.id)::integer
          FROM products product
          LEFT JOIN bootcamps bootcamp ON bootcamp.product_id = product.id
          LEFT JOIN video_classes video_class ON video_class.product_id = product.id
          WHERE product.deleted_at IS NULL
            AND product.is_published = true
            AND product.publication_status = 'published'
            AND (bootcamp.id IS NOT NULL OR video_class.id IS NOT NULL)
        ) AS learning_products,
        (
          SELECT COUNT(DISTINCT product.id)::integer
          FROM products product
          INNER JOIN digital_files digital_file ON digital_file.product_id = product.id
          WHERE product.deleted_at IS NULL
            AND product.is_published = true
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

  private async getProductCards(
    subtypeTable: 'bootcamps' | 'video_classes' | 'digital_files',
    limit: number,
  ): Promise<HomeProductCardResponseDto[]> {
    const productType = {
      bootcamps: 'bootcamp',
      video_classes: 'video_class',
      digital_files: 'digital_product',
    }[subtypeTable];
    const rows = (await this.products.query(
      `
        SELECT
          product.id,
          product.title,
          product.product_type,
          product.level,
          product.price,
          product.currency,
          product.original_price,
          product.cover_asset_id,
          cover.object_key AS cover_object_key,
          COALESCE(
            array_remove(array_agg(DISTINCT category.name), NULL),
            ARRAY[]::varchar[]
          ) AS categories,
          COALESCE(ROUND(AVG(review.rating)::numeric, 1), 0) AS rating,
          COUNT(DISTINCT review.id)::integer AS review_count,
          merchant.id AS merchant_id,
          merchant.store_name AS merchant_name,
          merchant_profile.slug AS merchant_slug,
          merchant_profile.avatar_asset_id AS merchant_avatar_asset_id,
          merchant_avatar.object_key AS merchant_avatar_object_key
        FROM products product
        INNER JOIN ${subtypeTable} subtype ON subtype.product_id = product.id
        INNER JOIN merchants merchant
          ON merchant.id = product.merchant_id AND merchant.deleted_at IS NULL
        LEFT JOIN merchant_profiles merchant_profile
          ON merchant_profile.merchant_id = merchant.id
          AND merchant_profile.deleted_at IS NULL
        LEFT JOIN file_assets cover
          ON cover.id = product.cover_asset_id AND cover.deleted_at IS NULL
        LEFT JOIN file_assets merchant_avatar
          ON merchant_avatar.id = merchant_profile.avatar_asset_id
          AND merchant_avatar.deleted_at IS NULL
        LEFT JOIN product_categories product_category
          ON product_category.product_id = product.id
          AND product_category.deleted_at IS NULL
        LEFT JOIN categories category
          ON category.id = product_category.category_id
          AND category.deleted_at IS NULL
        LEFT JOIN reviews review
          ON review.product_id = product.id AND review.deleted_at IS NULL
        WHERE product.deleted_at IS NULL
          AND product.is_published = true
          AND product.publication_status = 'published'
          AND product.product_type = $1
        GROUP BY
          product.id,
          cover.object_key,
          merchant.id,
          merchant_profile.slug,
          merchant_profile.avatar_asset_id,
          merchant_avatar.object_key
        ORDER BY COALESCE(product.published_at, product.created_at) DESC
        LIMIT $2
      `,
      [productType, limit],
    )) as ProductCardRow[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      product_type: row.product_type,
      level: row.level,
      price: Number(row.price),
      currency: row.currency,
      original_price:
        row.original_price === null ? null : Number(row.original_price),
      cover_asset_id: row.cover_asset_id,
      cover_object_key: row.cover_object_key,
      categories: row.categories ?? [],
      rating: Number(row.rating),
      review_count: Number(row.review_count),
      merchant_id: row.merchant_id,
      merchant_name: row.merchant_name,
      merchant_slug: row.merchant_slug,
      merchant_avatar_asset_id: row.merchant_avatar_asset_id,
      merchant_avatar_object_key: row.merchant_avatar_object_key,
    }));
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
          merchant_profile.avatar_asset_id,
          merchant_avatar.object_key AS avatar_object_key,
          latest_product.title AS best_product_title,
          latest_product.cover_asset_id AS best_product_cover_asset_id,
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
      avatar_asset_id: row.avatar_asset_id,
      avatar_object_key: row.avatar_object_key,
      best_product_title: row.best_product_title,
      best_product_cover_asset_id: row.best_product_cover_asset_id,
      best_product_cover_object_key: row.best_product_cover_object_key,
      best_product_rating:
        row.best_product_rating === null
          ? null
          : Number(row.best_product_rating),
    }));
  }

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
          reviewer_profile.avatar_asset_id AS user_avatar_asset_id,
          reviewer_avatar.object_key AS user_avatar_object_key,
          product.id AS product_id,
          product.title AS product_title
        FROM reviews review
        INNER JOIN users reviewer
          ON reviewer.id = review.user_id AND reviewer.deleted_at IS NULL
        INNER JOIN products product
          ON product.id = review.product_id AND product.deleted_at IS NULL
        LEFT JOIN user_profiles reviewer_profile
          ON reviewer_profile.user_id = reviewer.id
          AND reviewer_profile.deleted_at IS NULL
        LEFT JOIN file_assets reviewer_avatar
          ON reviewer_avatar.id = reviewer_profile.avatar_asset_id
          AND reviewer_avatar.deleted_at IS NULL
        WHERE review.deleted_at IS NULL
          AND NULLIF(BTRIM(review.comment), '') IS NOT NULL
          AND product.is_published = true
          AND product.publication_status = 'published'
        ORDER BY review.created_at DESC
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
      user_avatar_asset_id: row.user_avatar_asset_id,
      user_avatar_object_key: row.user_avatar_object_key,
      product_id: row.product_id,
      product_title: row.product_title,
    }));
  }
}

interface StatisticsRow {
  active_students: string;
  learning_products: string;
  digital_products: string;
  platform_rating: string;
}

interface ProductCardRow {
  id: string;
  title: string;
  product_type: string;
  level: string | null;
  price: string;
  currency: string;
  original_price: string | null;
  cover_asset_id: string | null;
  cover_object_key: string | null;
  categories: string[] | null;
  rating: string;
  review_count: string;
  merchant_id: string;
  merchant_name: string;
  merchant_slug: string | null;
  merchant_avatar_asset_id: string | null;
  merchant_avatar_object_key: string | null;
}

interface MerchantCardRow {
  id: string;
  name: string;
  slug: string | null;
  avatar_asset_id: string | null;
  avatar_object_key: string | null;
  best_product_title: string | null;
  best_product_cover_asset_id: string | null;
  best_product_cover_object_key: string | null;
  best_product_rating: string | null;
}

interface TestimonialRow {
  id: string;
  rating: string;
  comment: string;
  created_at: Date;
  user_name: string;
  user_avatar_asset_id: string | null;
  user_avatar_object_key: string | null;
  product_id: string;
  product_title: string;
}
