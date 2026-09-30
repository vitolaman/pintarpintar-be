import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
           class.title, NULL::varchar AS image, NULL::varchar AS category, NULL::varchar AS level,
           (CASE WHEN class."discountedPrice" > 0 THEN class."discountedPrice" ELSE COALESCE(class."originalPrice", 0) END)::numeric AS price,
           COALESCE(class."originalPrice", 0)::numeric AS list_price,
           class.created_at, class.merchant_id, class.description,
           COALESCE(class_reviews.rating, 0) AS rating,
           COALESCE(class_reviews.review_count, 0) AS review_count,
           COALESCE(class_students.students, 0) AS students_count
    FROM classes class
    LEFT JOIN class_reviews ON class_reviews.class_id = class.id
    LEFT JOIN class_students ON class_students.class_id = class.id
    WHERE class.status = 'published' AND class.deleted_at IS NULL
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
      `SELECT * FROM (${CARD_SQL}) cards ORDER BY ${SORT_SQL[sort]}, cards.id
       LIMIT $7 OFFSET $8`,
      [...cardParams(filter), limit, offset],
    );
    return rows.map(toCard);
  }

  async findClass(id: string) {
    const row = await this.findCardRow(id, ['kelas', 'bootcamp']);
    const [mentors, chapters, videos, files, meetings] = await Promise.all([
      this.dataSource.query(
        `SELECT mentor_user.name, profile.headline, avatar.object_key AS avatar_object_key, link.role
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
        `SELECT video.id, video.chapter_id, video.title, video.duration
         FROM videos video INNER JOIN chapters chapter ON chapter.id = video.chapter_id
         WHERE chapter.class_id = $1 AND video.deleted_at IS NULL AND chapter.deleted_at IS NULL
         ORDER BY video.created_at, video.id`,
        [id],
      ),
      this.dataSource.query(
        `SELECT resource.id, resource.chapter_id, resource.name, resource.type, resource.size
         FROM file_resources resource INNER JOIN chapters chapter ON chapter.id = resource.chapter_id
         WHERE chapter.class_id = $1 AND resource.deleted_at IS NULL AND chapter.deleted_at IS NULL
         ORDER BY resource.created_at, resource.id`,
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
          .map(({ id: videoId, title, duration }) => ({
            id: videoId,
            title,
            duration,
          })),
        files: files
          .filter((file) => file.chapter_id === chapter.id)
          .map(({ id: fileId, name, type, size }) => ({
            id: fileId,
            name,
            type,
            size,
          })),
      })),
      meetings,
    };
    return { data: detail, responseMessage: 'Get class success' };
  }

  async findDigitalProduct(id: string) {
    const row = await this.findCardRow(id, ['digital']);
    const files = await this.dataSource.query(
      `SELECT id, file_format AS format, file_size AS size FROM digital_files
       WHERE product_id = $1 AND deleted_at IS NULL ORDER BY created_at, id`,
      [id],
    );

    const detail: CatalogDigitalDetailDto = {
      ...toCard(row),
      description: row.description,
      files: files.map((file) => ({ ...file, size: Number(file.size) })),
    };
    return { data: detail, responseMessage: 'Get digital product success' };
  }

  private async findCardRow(id: string, types: string[]): Promise<CardRow> {
    const [row] = await this.dataSource.query(
      `SELECT * FROM (${CARD_SQL}) cards`,
      cardParams({ types, id }),
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
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
