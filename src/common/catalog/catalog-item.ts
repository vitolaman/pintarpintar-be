import { ApiProperty } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { EntityManager } from 'typeorm';
import { EnumInput } from '../decorator/input.decorator';
import { assetUrl } from '../storage/asset-url';
import { classKindSql } from './item-kind';

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
  @EnumInput(catalogItemTypes, {
    presence: 'filter',
    description:
      'Optional: the server resolves the kind from the id. When sent it must name the item family (kelas and bootcamp both accept any class).',
  })
  type?: CatalogItemType;

  @ApiProperty({ description: 'Class, digital product, or bundle id' })
  @IsUUID()
  id: string;
}

export interface CatalogItemColumns {
  classId: string | null;
  productId: string | null;
  bundleId: string | null;
}

export type ItemFamily = 'class' | 'product' | 'bundle';

/** The kinds a request may name for a class or digital product reference. */
export const contentItemTypes = ['kelas', 'bootcamp', 'digital'] as const;

export type ContentItemType = (typeof contentItemTypes)[number];

const FAMILY_OF_TYPE: Record<CatalogItemType, ItemFamily> = {
  kelas: 'class',
  bootcamp: 'class',
  digital: 'product',
  bundle: 'bundle',
};

const FAMILY_LABEL: Record<ItemFamily, string> = {
  class: 'class',
  product: 'digital product',
  bundle: 'bundle',
};

/**
 * A sent `type` only has to name the item's family: `kelas` and `bootcamp`
 * both accept any class. Rejects with 400 naming the item otherwise.
 */
export function assertItemFamily(
  id: string,
  sentType: CatalogItemType | undefined,
  family: ItemFamily,
): void {
  if (sentType && FAMILY_OF_TYPE[sentType] !== family) {
    throw new BadRequestException(
      `Item ${id} is a ${FAMILY_LABEL[family]}, not ${sentType}`,
    );
  }
}

/**
 * Resolves item ids of any kind to their table columns, in request order.
 * Ids are UUIDs, so an id names at most one row across the three tables.
 * Deleted rows still resolve; availability is checked by the caller. A sent
 * `type` only has to name the item's family.
 */
export async function resolveItemReferences(
  manager: EntityManager,
  refs: Array<{ id: string; type?: CatalogItemType }>,
): Promise<CatalogItemColumns[]> {
  if (refs.length === 0) return [];
  const ids = refs.map((ref) => ref.id);
  const rows: Array<{ id: string; family: ItemFamily }> = await manager.query(
    `SELECT id, 'class' AS family FROM classes WHERE id = ANY($1::uuid[])
     UNION ALL
     SELECT id, 'product' FROM products WHERE id = ANY($1::uuid[])
     UNION ALL
     SELECT id, 'bundle' FROM bundles WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  const familyOf = new Map(rows.map((row) => [row.id, row.family]));

  return refs.map((ref) => {
    const family = familyOf.get(ref.id);
    if (!family) {
      throw new BadRequestException(`Item ${ref.id} is not available`);
    }
    assertItemFamily(ref.id, ref.type, family);
    return {
      classId: family === 'class' ? ref.id : null,
      productId: family === 'product' ? ref.id : null,
      bundleId: family === 'bundle' ? ref.id : null,
    };
  });
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
    description: 'Public cover URL (null without a cover)',
  })
  image_url: string | null;

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
// live details. Deleted items, and items of an inactive or deleted merchant,
// are included and reported unavailable.
const CATALOG_DETAILS_SQL = `
  SELECT ${classKindSql('class.type')} AS type,
         class.id, class.title, class_cover.object_key AS image,
         (CASE WHEN class."discountedPrice" > 0 THEN class."discountedPrice" ELSE COALESCE(class."originalPrice", 0) END)::numeric AS price,
         COALESCE(class."originalPrice", 0)::numeric AS original_price,
         class.merchant_id,
         class.status IN ('published', 'archived') AND class.deleted_at IS NULL AS is_available
  FROM classes class
  LEFT JOIN file_assets class_cover
    ON class_cover.id = class.cover_asset_id AND class_cover.deleted_at IS NULL
  WHERE class.id = ANY($1::uuid[])
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
    `SELECT catalog.*, merchant.store_name AS merchant_name, profile.slug AS merchant_slug,
            COALESCE(merchant.status = 'active' AND merchant.deleted_at IS NULL, false) AS merchant_active
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
        image_url: assetUrl(row.image),
        price: Number(row.price),
        original_price: Number(row.original_price),
        merchant_id: row.merchant_id,
        merchant_name: row.merchant_name,
        merchant_slug: row.merchant_slug,
        is_available: row.is_available && row.merchant_active,
      },
    ]),
  );
}

export function referenceId(ref: CatalogItemColumns): string {
  return ref.classId ?? ref.productId ?? ref.bundleId;
}

/**
 * Returns the ids among `refs` that the user already owns: an active class
 * enrollment, unexpired product access, or a bundle that was bought or whose
 * items are all owned.
 */
export async function findOwnedItemIds(
  manager: EntityManager,
  userId: string,
  refs: CatalogItemColumns[],
): Promise<Set<string>> {
  if (refs.length === 0) return new Set();

  const rows: Array<{ id: string }> = await manager.query(
    `SELECT enrollment.class_id AS id FROM enrollments enrollment
     WHERE enrollment.user_id = $1 AND enrollment.class_id = ANY($2::uuid[])
       AND enrollment.deleted_at IS NULL
     UNION
     SELECT access.product_id FROM user_access access
     WHERE access.user_id = $1 AND access.product_id = ANY($3::uuid[])
       AND access.deleted_at IS NULL
       AND (access.expires_at IS NULL OR access.expires_at > now())
     UNION
     SELECT bundle.id FROM bundles bundle
     WHERE bundle.id = ANY($4::uuid[])
       AND (
         EXISTS (
           SELECT 1 FROM order_items item
           INNER JOIN orders purchase ON purchase.id = item.order_id
           WHERE purchase.user_id = $1 AND item.bundle_id = bundle.id
             AND purchase.status = 'paid'
             AND item.deleted_at IS NULL AND purchase.deleted_at IS NULL)
         OR NOT EXISTS (
           SELECT 1 FROM bundle_items item
           WHERE item.bundle_id = bundle.id AND item.deleted_at IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM enrollments enrollment
               WHERE enrollment.user_id = $1 AND enrollment.class_id = item.class_id
                 AND enrollment.deleted_at IS NULL)
             AND NOT EXISTS (
               SELECT 1 FROM user_access access
               WHERE access.user_id = $1 AND access.product_id = item.product_id
                 AND access.deleted_at IS NULL
                 AND (access.expires_at IS NULL OR access.expires_at > now()))))`,
    [
      userId,
      refs.map((ref) => ref.classId).filter(Boolean),
      refs.map((ref) => ref.productId).filter(Boolean),
      refs.map((ref) => ref.bundleId).filter(Boolean),
    ],
  );
  return new Set(rows.map((row) => row.id));
}
