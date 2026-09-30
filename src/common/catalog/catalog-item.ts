import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { EntityManager } from 'typeorm';

/**
 * Purchasable catalog items across the separate catalogs: Vito's classes
 * (`video` = kelas, `live-bootcamp` = bootcamp), digital products, and
 * merchant bundles, in the frontend's vocabulary.
 */
export const catalogItemTypes = [
  'kelas',
  'bootcamp',
  'digital',
  'bundle',
] as const;

export type CatalogItemType = (typeof catalogItemTypes)[number];

export class CatalogItemRefDto {
  @ApiProperty({ enum: catalogItemTypes })
  @IsIn(catalogItemTypes)
  type: CatalogItemType;

  @ApiProperty({ description: 'Class, digital product, or bundle id' })
  @IsUUID()
  id: string;
}

export interface CatalogItemColumns {
  classId: string | null;
  productId: string | null;
  bundleId: string | null;
}

export function toReferenceColumns(ref: CatalogItemRefDto): CatalogItemColumns {
  return {
    classId: ref.type === 'kelas' || ref.type === 'bootcamp' ? ref.id : null,
    productId: ref.type === 'digital' ? ref.id : null,
    bundleId: ref.type === 'bundle' ? ref.id : null,
  };
}

export class CatalogItemDetailsDto {
  @ApiProperty({ enum: catalogItemTypes })
  type: CatalogItemType;

  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({
    nullable: true,
    description:
      'Cover object key (null for classes and bundles without a cover)',
  })
  image: string | null;

  @ApiProperty({ example: 299000, description: 'Current selling price' })
  price: number;

  @ApiProperty({
    example: 350000,
    description: 'List price, or the item total for bundles',
  })
  original_price: number;

  @ApiProperty()
  merchant_id: string;

  @ApiProperty({ nullable: true })
  merchant_name: string | null;

  @ApiProperty({ nullable: true })
  merchant_slug: string | null;

  @ApiProperty({ description: 'Publicly available for purchase' })
  is_available: boolean;
}

// Resolves typed references ($1 class ids, $2 product ids, $3 bundle ids) to
// live details. Deleted items are included and reported unavailable.
const CATALOG_DETAILS_SQL = `
  SELECT CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END AS type,
         class.id, class.title, NULL::varchar AS image,
         (CASE WHEN class."discountedPrice" > 0 THEN class."discountedPrice" ELSE COALESCE(class."originalPrice", 0) END)::numeric AS price,
         COALESCE(class."originalPrice", 0)::numeric AS original_price,
         class.merchant_id,
         class.status = 'published' AND class.deleted_at IS NULL AS is_available
  FROM classes class WHERE class.id = ANY($1::uuid[])
  UNION ALL
  SELECT 'digital', product.id, product.title, cover.object_key,
         (CASE WHEN product.discount_price > 0 THEN product.discount_price ELSE COALESCE(product.original_price, 0) END)::numeric,
         COALESCE(product.original_price, 0)::numeric,
         product.merchant_id,
         product.is_published AND product.deleted_at IS NULL
  FROM products product
  LEFT JOIN file_assets cover ON cover.id = product.cover_asset_id AND cover.deleted_at IS NULL
  WHERE product.id = ANY($2::uuid[])
  UNION ALL
  SELECT 'bundle', bundle.id, bundle.title, cover.object_key, bundle.bundle_price,
         COALESCE((
           SELECT sum(CASE
             WHEN item.class_id IS NOT NULL THEN (CASE WHEN class."discountedPrice" > 0 THEN class."discountedPrice" ELSE COALESCE(class."originalPrice", 0) END)::numeric
             ELSE (CASE WHEN product.discount_price > 0 THEN product.discount_price ELSE COALESCE(product.original_price, 0) END)::numeric END)
           FROM bundle_items item
           LEFT JOIN classes class ON class.id = item.class_id
           LEFT JOIN products product ON product.id = item.product_id
           WHERE item.bundle_id = bundle.id
         ), 0),
         bundle.merchant_id,
         bundle.status IN ('published', 'unlisted') AND bundle.deleted_at IS NULL
  FROM bundles bundle
  LEFT JOIN file_assets cover ON cover.id = bundle.cover_asset_id AND cover.deleted_at IS NULL
  WHERE bundle.id = ANY($3::uuid[])
`;

export async function loadCatalogItems(
  manager: EntityManager,
  refs: CatalogItemColumns[],
): Promise<Map<string, CatalogItemDetailsDto>> {
  if (refs.length === 0) return new Map();

  const rows = await manager.query(
    `SELECT catalog.*, merchant.store_name AS merchant_name, profile.slug AS merchant_slug
     FROM (${CATALOG_DETAILS_SQL}) catalog
     LEFT JOIN merchants merchant ON merchant.id = catalog.merchant_id
     LEFT JOIN merchant_profiles profile ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL`,
    [
      refs.map((ref) => ref.classId).filter(Boolean),
      refs.map((ref) => ref.productId).filter(Boolean),
      refs.map((ref) => ref.bundleId).filter(Boolean),
    ],
  );

  return new Map(
    rows.map((row) => [
      row.id,
      {
        type: row.type,
        id: row.id,
        title: row.title,
        image: row.image,
        price: Number(row.price),
        original_price: Number(row.original_price),
        merchant_id: row.merchant_id,
        merchant_name: row.merchant_name,
        merchant_slug: row.merchant_slug,
        is_available: row.is_available,
      },
    ]),
  );
}

export function referenceId(ref: CatalogItemColumns): string {
  return ref.classId ?? ref.productId ?? ref.bundleId;
}
