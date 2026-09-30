import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { assetUrl } from '../../common/storage/asset-url';
import {
  CatalogCardDto,
  CatalogCardType,
  CatalogClassDetailDto,
  CatalogDigitalDetailDto,
  CatalogQueryDto,
  CatalogSort,
} from './dto/catalog.dto';

// Current selling price follows the PM rule: the discounted price when set,
// otherwise the list price.
const CARD_SQL = `
  WITH class_reviews AS (
    SELECT class_id, avg(rating) AS rating, count(*) AS review_count
    FROM reviews WHERE class_id IS NOT NULL AND deleted_at IS NULL GROUP BY class_id
  ), product_reviews AS (
    SELECT product_id, avg(rating) AS rating, count(*) AS review_count
    FROM reviews WHERE product_id IS NOT NULL AND deleted_at IS NULL GROUP BY product_id
  ), class_students AS (
    SELECT class_id, count(DISTINCT user_id) AS students
    FROM enrollments WHERE deleted_at IS NULL GROUP BY class_id
  ), product_students AS (
    SELECT product_id, count(DISTINCT user_id) AS students
    FROM user_access WHERE deleted_at IS NULL GROUP BY product_id
  ), items AS (
    SELECT class.id,
           CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END AS type,
           class.title, class_cover.object_key AS image, NULL::varchar AS category, NULL::varchar AS level,
           (CASE WHEN class."discountedPrice" > 0 THEN class."discountedPrice" ELSE COALESCE(class."originalPrice", 0) END)::numeric AS price,
           COALESCE(class."originalPrice", 0)::numeric AS list_price,
           class.created_at, class.merchant_id, class.description,
           COALESCE(class_reviews.rating, 0) AS rating,
           COALESCE(class_reviews.review_count, 0) AS review_count,
           COALESCE(class_students.students, 0) AS students_count
    FROM classes class
    LEFT JOIN file_assets class_cover
      ON class_cover.id = class.cover_asset_id AND class_cover.deleted_at IS NULL
    LEFT JOIN class_reviews ON class_reviews.class_id = class.id
    LEFT JOIN class_students ON class_students.class_id = class.id
    WHERE class.deleted_at IS NULL
      AND (class.status = 'published' OR ($9::boolean AND class.status = 'archived'))
    UNION ALL
    SELECT product.id, 'digital', product.title, cover.object_key, category.name, product.level,
           (CASE WHEN product.discount_price > 0 THEN product.discount_price ELSE COALESCE(product.original_price, 0) END)::numeric,
           COALESCE(product.original_price, 0)::numeric,
           product.created_at, product.merchant_id, product.description,
           COALESCE(product_reviews.rating, 0),
           COALESCE(product_reviews.review_count, 0),
           COALESCE(product_students.students, 0)
    FROM products product
    LEFT JOIN file_assets cover ON cover.id = product.cover_asset_id AND cover.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT category.name FROM product_categories link
      INNER JOIN categories category ON category.id = link.category_id AND category.deleted_at IS NULL
      WHERE link.product_id = product.id AND link.deleted_at IS NULL
      ORDER BY category.name LIMIT 1
    ) category ON true
    LEFT JOIN product_reviews ON product_reviews.product_id = product.id
    LEFT JOIN product_students ON product_students.product_id = product.id
    WHERE product.is_published = true AND product.publication_status = 'published'
      AND product.deleted_at IS NULL
  )
  SELECT items.*, merchant.store_name AS merchant_name, profile.slug AS merchant_slug,
         avatar.object_key AS merchant_avatar_object_key
  FROM items
  INNER JOIN merchants merchant
    ON merchant.id = items.merchant_id AND merchant.deleted_at IS NULL AND merchant.status = 'active'
  LEFT JOIN merchant_profiles profile ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
  LEFT JOIN file_assets avatar ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
  WHERE ($1::text[] IS NULL OR items.type = ANY($1::text[]))
    AND ($2::text IS NULL OR items.title ILIKE '%' || $2 || '%' ESCAPE '\\')
    AND ($3::text IS NULL OR items.level = $3)
    AND ($4::text IS NULL OR EXISTS (
      SELECT 1 FROM product_categories link
      INNER JOIN categories category ON category.id = link.category_id AND category.deleted_at IS NULL
      WHERE link.product_id = items.id AND link.deleted_at IS NULL AND category.slug = $4))
    AND (NOT $5::boolean OR (items.list_price > 0 AND items.price < items.list_price))
    AND ($6::uuid IS NULL OR items.id = $6)
    AND ($7::uuid IS NULL OR items.merchant_id = $7)
    AND ($8::text[] IS NULL OR EXISTS (
      SELECT 1 FROM digital_files file
      WHERE file.product_id = items.id AND file.deleted_at IS NULL
        AND lower(file.file_format) = ANY($8::text[])))
`;

// Mentor and file details for already filtered, sorted, and paged cards; kept
// out of CARD_SQL so they are looked up for one page instead of every item.
const PAGE_DETAILS_SQL = (page: string) => `
  SELECT page.*, card_mentor.id AS mentor_id, card_mentor.name AS mentor_name,
         card_mentor.avatar_object_key AS mentor_avatar_object_key,
         card_files.file_format, card_files.file_size
  FROM (${page}) page
  LEFT JOIN LATERAL (
    SELECT mentor.id, mentor_user.name, mentor_avatar.object_key AS avatar_object_key,
           link.created_at AS assigned_at
    FROM class_mentors link
    INNER JOIN mentors mentor ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
    INNER JOIN users mentor_user ON mentor_user.id = mentor.user_id AND mentor_user.deleted_at IS NULL
    LEFT JOIN user_profiles mentor_profile ON mentor_profile.user_id = mentor_user.id AND mentor_profile.deleted_at IS NULL
    LEFT JOIN file_assets mentor_avatar ON mentor_avatar.id = mentor_profile.avatar_asset_id AND mentor_avatar.deleted_at IS NULL
    WHERE page.type <> 'digital' AND link.class_id = page.id AND link.deleted_at IS NULL
    UNION ALL
    SELECT mentor.id, mentor_user.name, mentor_avatar.object_key, assignment.created_at
    FROM product_mentors assignment
    INNER JOIN users mentor_user ON mentor_user.id = assignment.mentor_user_id AND mentor_user.deleted_at IS NULL
    LEFT JOIN mentors mentor ON mentor.user_id = mentor_user.id AND mentor.deleted_at IS NULL
    LEFT JOIN user_profiles mentor_profile ON mentor_profile.user_id = mentor_user.id AND mentor_profile.deleted_at IS NULL
    LEFT JOIN file_assets mentor_avatar ON mentor_avatar.id = mentor_profile.avatar_asset_id AND mentor_avatar.deleted_at IS NULL
    WHERE page.type = 'digital' AND assignment.product_id = page.id AND assignment.deleted_at IS NULL
    ORDER BY assigned_at
    LIMIT 1
  ) card_mentor ON true
  LEFT JOIN LATERAL (
    SELECT upper(string_agg(DISTINCT lower(file.file_format), ', ')) AS file_format,
           sum(file.file_size)::bigint AS file_size
    FROM digital_files file
    WHERE page.type = 'digital' AND file.product_id = page.id AND file.deleted_at IS NULL
  ) card_files ON true
`;

const SORT_SQL: Record<CatalogSort | 'random', string> = {
  terbaru: 'created_at DESC',
  terlama: 'created_at ASC',
  terpopuler: 'students_count DESC',
  'terkurang-populer': 'students_count ASC',
  termurah: 'price ASC',
  termahal: 'price DESC',
  rating: 'rating DESC, review_count DESC',
  title: 'title ASC',
  random: 'random()',
};

export interface CardFilter {
  types?: string[];
  search?: string;
  level?: string;
  category?: string;
  discountedOnly?: boolean;
  id?: string;
  merchantId?: string;
  fileFormats?: string[];
  // Archived classes are unlisted: shown only when opened by id.
  includeUnlisted?: boolean;
}

interface CardRow {
  id: string;
  type: CatalogCardType;
  title: string;
  image: string | null;
  category: string | null;
  level: string | null;
  price: string;
  list_price: string;
  created_at: Date;
  merchant_id: string;
  description: string | null;
  rating: string;
  review_count: string;
  students_count: string;
  merchant_name: string;
  merchant_slug: string | null;
  merchant_avatar_object_key: string | null;
  mentor_id: string | null;
  mentor_name: string | null;
  mentor_avatar_object_key: string | null;
  file_format: string | null;
  file_size: string | null;
}

@Injectable()
export class CatalogService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findItems(query: CatalogQueryDto) {
    const { page, limit } = query;
    const filter: CardFilter = {
      types: query.type,
      search: query.search,
      level: query.level,
      category: query.category,
      merchantId: query.merchant_id,
      fileFormats: query.file_format,
    };
    const [countRow] = await this.dataSource.query(
      `SELECT count(*)::integer AS total FROM (${CARD_SQL}) cards`,
      cardParams(filter),
    );
    const total: number = countRow.total;
    const data =
      total === 0
        ? []
        : await this.findCards(filter, query.sort, limit, (page - 1) * limit);

    return {
      data,
      meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
      responseMessage: 'Get catalog items success',
    };
  }

  async findCards(
    filter: CardFilter,
    sort: CatalogSort | 'random',
    limit: number,
    offset = 0,
  ): Promise<CatalogCardDto[]> {
    const rows: CardRow[] = await this.dataSource.query(
      `${PAGE_DETAILS_SQL(
        `SELECT cards.*, row_number() OVER (ORDER BY ${SORT_SQL[sort]}, cards.id) AS position
         FROM (${CARD_SQL}) cards
         ORDER BY position
         LIMIT $10 OFFSET $11`,
      )}
       ORDER BY page.position`,
      [...cardParams(filter), limit, offset],
    );
    return rows.map(toCard);
  }

  async findClass(id: string, viewerId?: string) {
    const row = await this.findCardRow(id, ['kelas', 'bootcamp']);
    const [mentors, chapters, videos, files, meetings, [ownership]] =
      await Promise.all([
        this.dataSource.query(
          `SELECT mentor.id, mentor_user.name, profile.headline, avatar.object_key AS avatar_object_key, link.role
         FROM class_mentors link
         INNER JOIN mentors mentor ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
         INNER JOIN users mentor_user ON mentor_user.id = mentor.user_id AND mentor_user.deleted_at IS NULL
         LEFT JOIN user_profiles profile ON profile.user_id = mentor_user.id AND profile.deleted_at IS NULL
         LEFT JOIN file_assets avatar ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
         WHERE link.class_id = $1 AND link.deleted_at IS NULL
         ORDER BY link.created_at, link.id`,
          [id],
        ),
        this.dataSource.query(
          `SELECT id, title, description FROM chapters
         WHERE class_id = $1 AND deleted_at IS NULL ORDER BY "order", created_at, id`,
          [id],
        ),
        this.dataSource.query(
          `SELECT video.id, video.chapter_id, video.title, video.duration, video.description,
                video.created_at
         FROM videos video INNER JOIN chapters chapter ON chapter.id = video.chapter_id
         WHERE chapter.class_id = $1 AND video.deleted_at IS NULL AND chapter.deleted_at IS NULL
         ORDER BY video."order", video.created_at, video.id`,
          [id],
        ),
        this.dataSource.query(
          `SELECT resource.id, resource.chapter_id, resource.name, resource.type, resource.size,
                resource.description, resource.created_at
         FROM file_resources resource INNER JOIN chapters chapter ON chapter.id = resource.chapter_id
         WHERE chapter.class_id = $1 AND resource.deleted_at IS NULL AND chapter.deleted_at IS NULL
         ORDER BY resource."order", resource.created_at, resource.id`,
          [id],
        ),
        row.type === 'bootcamp'
          ? this.dataSource.query(
              `SELECT id, title, "date"::text AS date, to_char("time", 'HH24:MI') AS time, status
             FROM meetings WHERE class_id = $1 AND deleted_at IS NULL
             ORDER BY "date" NULLS LAST, "time" NULLS LAST, id`,
              [id],
            )
          : [],
        this.dataSource.query(
          `SELECT EXISTS (
           SELECT 1 FROM enrollments
           WHERE class_id = $1 AND user_id = $2 AND deleted_at IS NULL) AS owned`,
          [id, viewerId ?? null],
        ),
      ]);

    const detail: CatalogClassDetailDto = {
      ...toCard(row),
      description: row.description,
      duration: null,
      requirements: [],
      mentors,
      chapters: chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        description: chapter.description,
        videos: videos
          .filter((video) => video.chapter_id === chapter.id)
          .map((video) => ({
            id: video.id,
            title: video.title,
            duration: video.duration,
            description: video.description,
            created_at: video.created_at,
          })),
        files: files
          .filter((file) => file.chapter_id === chapter.id)
          .map((file) => ({
            id: file.id,
            name: file.name,
            type: file.type,
            size: file.size,
            description: file.description,
            created_at: file.created_at,
          })),
      })),
      meetings,
      is_owned: ownership.owned,
    };
    return { data: detail, responseMessage: 'Get class success' };
  }

  async findDigitalProduct(id: string, viewerId?: string) {
    const row = await this.findCardRow(id, ['digital']);
    const [files, [ownership]] = await Promise.all([
      this.dataSource.query(
        `SELECT file.id, file.file_format AS format, file.file_size AS size,
                COALESCE(asset.original_filename, regexp_replace(file.file_url, '^.*/', '')) AS name
         FROM digital_files file
         LEFT JOIN file_assets asset ON asset.id = file.asset_id AND asset.deleted_at IS NULL
         WHERE file.product_id = $1 AND file.deleted_at IS NULL
         ORDER BY file.created_at, file.id`,
        [id],
      ),
      this.dataSource.query(
        `SELECT EXISTS (
           SELECT 1 FROM user_access
           WHERE product_id = $1 AND user_id = $2 AND deleted_at IS NULL
             AND (expires_at IS NULL OR expires_at > now())) AS owned`,
        [id, viewerId ?? null],
      ),
    ]);

    const detail: CatalogDigitalDetailDto = {
      ...toCard(row),
      description: row.description,
      files: files.map((file) => ({ ...file, size: Number(file.size) })),
      is_owned: ownership.owned,
    };
    return { data: detail, responseMessage: 'Get digital product success' };
  }

  private async findCardRow(id: string, types: string[]): Promise<CardRow> {
    const [row] = await this.dataSource.query(
      PAGE_DETAILS_SQL(`SELECT * FROM (${CARD_SQL}) cards`),
      cardParams({ types, id, includeUnlisted: true }),
    );
    if (!row) throw new NotFoundException('Catalog item not found');
    return row;
  }
}

function cardParams(filter: CardFilter): unknown[] {
  return [
    filter.types?.length ? filter.types : null,
    filter.search ? escapeLike(filter.search) : null,
    filter.level ?? null,
    filter.category ?? null,
    filter.discountedOnly ?? false,
    filter.id ?? null,
    filter.merchantId ?? null,
    filter.fileFormats?.length ? filter.fileFormats : null,
    filter.includeUnlisted ?? false,
  ];
}

function toCard(row: CardRow): CatalogCardDto {
  const price = Number(row.price);
  const listPrice = Number(row.list_price);
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    image: row.image,
    category: row.category,
    level: row.level,
    price,
    original_price: listPrice,
    discount_percent:
      listPrice > 0 && price < listPrice
        ? Math.round(((listPrice - price) / listPrice) * 100)
        : null,
    rating: Math.round(Number(row.rating) * 10) / 10,
    review_count: Number(row.review_count),
    students_count: Number(row.students_count),
    created_at: row.created_at,
    merchant: {
      id: row.merchant_id,
      name: row.merchant_name,
      slug: row.merchant_slug,
      avatar_object_key: row.merchant_avatar_object_key,
    },
    image_url: assetUrl(row.image),
    mentor: row.mentor_name
      ? {
          id: row.mentor_id,
          name: row.mentor_name,
          avatar_url: assetUrl(row.mentor_avatar_object_key),
        }
      : null,
    file_format: row.file_format,
    file_size: row.file_size === null ? null : Number(row.file_size),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
