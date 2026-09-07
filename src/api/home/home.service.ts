import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../profile/entities/product.entity';
import {
  HomeMerchantCardResponseDto,
  HomeProductCardResponseDto,
  HomeResponseDto,
  HomeStatisticsResponseDto,
} from './dto/home-response.dto';

@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  async getHome(limit: number) {
    const [statistics, bootcamps, videoClasses, digitalProducts, merchants] =
      await Promise.all([
        this.getStatistics(),
        this.getProductCards('bootcamps', limit),
        this.getProductCards('video_classes', limit),
        this.getProductCards('digital_files', limit),
        this.getMerchantCards(limit),
      ]);

    const data: HomeResponseDto = {
      statistics,
      featured_bootcamps: bootcamps,
      featured_video_classes: videoClasses,
      featured_digital_products: digitalProducts,
      latest_merchants: merchants,
    };

    return {
      data,
      responseMessage: 'Get home success',
    };
  }

  private async getStatistics(): Promise<HomeStatisticsResponseDto> {
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
        GROUP BY
          product.id,
          cover.object_key,
          merchant.id,
          merchant_profile.slug,
          merchant_profile.avatar_asset_id,
          merchant_avatar.object_key
        ORDER BY COALESCE(product.published_at, product.created_at) DESC
        LIMIT $1
      `,
      [limit],
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
