import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assetUrl } from '../../common/storage/asset-url';
import { Merchant } from '../merchant/entities/merchant.entity';
import {
  BundleItemInputDto,
  BundleItemType,
  BundleListQueryDto,
  CreateBundleDto,
  PublicBundleQueryDto,
  UpdateBundleDto,
} from './dto/bundle-request.dto';
import {
  BundleItemResponseDto,
  BundleResponseDto,
  PublicBundleResponseDto,
} from './dto/bundle-response.dto';
import { BundleItem } from './entities/bundle-item.entity';
import { Bundle, BundleStatus } from './entities/bundle.entity';
import { assertOwnedAsset } from '../file-asset/asset-purpose-rules';
import { applyCoverInput, findCovers } from '../item-cover/item-covers';
import { paginationMeta } from '~/common/dto/response-meta.dto';

// Current selling price: the discounted price when set, otherwise the list price.
const CLASS_PRICE_SQL = `(CASE WHEN class."discountedPrice" > 0 THEN class."discountedPrice" ELSE COALESCE(class."originalPrice", 0) END)::numeric`;
const PRODUCT_PRICE_SQL = `(CASE WHEN product.discount_price > 0 THEN product.discount_price ELSE COALESCE(product.original_price, 0) END)::numeric`;

// The merchant's own classes and digital products that can be bundled.
const CATALOG_SQL = `
  SELECT class.id, 'kelas' AS type, class.type AS class_type, class.title,
         ${CLASS_PRICE_SQL} AS price, class_cover.object_key AS image,
         class.status IN ('published', 'archived') AS is_available
  FROM classes class
  LEFT JOIN file_assets class_cover
    ON class_cover.id = class.cover_asset_id AND class_cover.deleted_at IS NULL
  WHERE class.merchant_id = $1 AND class.deleted_at IS NULL
  UNION ALL
  SELECT product.id, 'digital', NULL, product.title,
         ${PRODUCT_PRICE_SQL}, cover.object_key, product.is_published
  FROM products product
  LEFT JOIN file_assets cover
    ON cover.id = product.cover_asset_id AND cover.deleted_at IS NULL
  WHERE product.merchant_id = $1 AND product.deleted_at IS NULL
`;

const PUBLIC_STATUSES: BundleStatus[] = ['published', 'unlisted'];

interface CatalogRow {
  id: string;
  type: BundleItemType;
  class_type: string | null;
  title: string;
  price: string;
  image: string | null;
  is_available: boolean;
}

interface BundleItemRow extends CatalogRow {
  bundle_id: string;
}

interface PublicBundleMerchantRow {
  merchant_name: string;
  merchant_slug: string | null;
}

interface BundleRow {
  merchant_id: string;
  id: string;
  title: string;
  description: string;
  cover_asset_id: string | null;
  cover_object_key: string | null;
  bundle_price: string;
  status: BundleStatus;
  post_purchase_instructions: string | null;
  created_at: Date;
}

@Injectable()
export class BundleService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findEligibleItems(userId: string) {
    const merchant = await this.findMerchant(this.dataSource.manager, userId);
    const rows: CatalogRow[] = await this.dataSource.query(
      `SELECT * FROM (${CATALOG_SQL}) catalog ORDER BY catalog.type, catalog.title, catalog.id`,
      [merchant.id],
    );

    return {
      data: rows.map((row) => this.toItem(row)),
      responseMessage: 'Get eligible bundle items success',
    };
  }

  async create(userId: string, input: CreateBundleDto) {
    const bundleId = await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      const status = input.status ?? 'published';

      const items = await this.resolveItems(manager, merchant.id, input.items);
      this.assertSellable(items, status, input.bundle_price);

      const bundle = await manager.save(
        Bundle,
        manager.create(Bundle, {
          merchantId: merchant.id,
          title: input.title,
          description: input.description,
          bundlePrice: String(input.bundle_price),
          postPurchaseInstructions: input.post_purchase_instructions ?? null,
          status,
        }),
      );
      await this.insertItems(manager, bundle.id, items);
      const main = await applyCoverInput(
        manager,
        { bundleId: bundle.id },
        input,
        null,
        (assetId) =>
          assertOwnedAsset(manager, userId, assetId, 'product_cover'),
      );
      if (main !== undefined) {
        await manager.update(Bundle, { id: bundle.id }, { coverAssetId: main });
      }
      return bundle.id;
    });

    return {
      data: await this.findResponse(bundleId),
      responseMessage: 'Create bundle success',
    };
  }

  async findAll(userId: string, query: BundleListQueryDto) {
    const merchant = await this.findMerchant(this.dataSource.manager, userId);
    const { page, limit } = query;
    const status = query.status ?? null;

    const [countRow] = await this.dataSource.query(
      `SELECT count(*)::integer AS total FROM bundles
       WHERE merchant_id = $1 AND deleted_at IS NULL AND ($2::varchar IS NULL OR status = $2)`,
      [merchant.id, status],
    );
    const total: number = countRow.total;

    const rows: BundleRow[] =
      total === 0
        ? []
        : await this.dataSource.query(
            `${BUNDLE_SELECT_SQL}
             WHERE bundle.merchant_id = $1 AND bundle.deleted_at IS NULL
               AND ($2::varchar IS NULL OR bundle.status = $2)
             ORDER BY bundle.created_at DESC, bundle.id DESC
             LIMIT $3 OFFSET $4`,
            [merchant.id, status, limit, (page - 1) * limit],
          );

    return {
      data: await this.toResponses(rows),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get bundles success',
    };
  }

  async findPublic(query: PublicBundleQueryDto) {
    const { page, limit } = query;
    const merchantId = query.merchant_id ?? null;
    const visible = `
      bundle.deleted_at IS NULL AND bundle.status = 'published'
      AND ($1::uuid IS NULL OR bundle.merchant_id = $1)
      AND EXISTS (
        SELECT 1 FROM merchants merchant
        WHERE merchant.id = bundle.merchant_id AND merchant.deleted_at IS NULL
          AND merchant.status = 'active'
      )`;

    const [countRow] = await this.dataSource.query(
      `SELECT count(*)::integer AS total FROM bundles bundle WHERE ${visible}`,
      [merchantId],
    );
    const total: number = countRow.total;
    const rows: (BundleRow & PublicBundleMerchantRow)[] =
      total === 0
        ? []
        : await this.dataSource.query(
            `SELECT bundle_row.*, merchant.store_name AS merchant_name,
                    profile.slug AS merchant_slug
             FROM (
               ${BUNDLE_SELECT_SQL}
               WHERE ${visible}
               ORDER BY bundle.created_at DESC, bundle.id DESC
               LIMIT $2 OFFSET $3
             ) bundle_row
             INNER JOIN merchants merchant ON merchant.id = bundle_row.merchant_id
             LEFT JOIN merchant_profiles profile
               ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
             ORDER BY bundle_row.created_at DESC, bundle_row.id DESC`,
            [merchantId, limit, (page - 1) * limit],
          );

    const responses = await this.toResponses(rows);
    // Listed field by field so private bundle fields never reach the public page.
    const data: PublicBundleResponseDto[] = responses.map((bundle, index) => ({
      id: bundle.id,
      title: bundle.title,
      description: bundle.description,
      cover_asset_id: bundle.cover_asset_id,
      cover_object_key: bundle.cover_object_key,
      cover_url: assetUrl(bundle.cover_object_key),
      covers: bundle.covers,
      items: bundle.items,
      original_total: bundle.original_total,
      bundle_price: bundle.bundle_price,
      saving_amount: bundle.saving_amount,
      saving_percent: bundle.saving_percent,
      sales_count: bundle.sales_count,
      created_at: bundle.created_at,
      merchant: {
        id: rows[index].merchant_id,
        name: rows[index].merchant_name,
        slug: rows[index].merchant_slug,
      },
    }));
    return {
      data,
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get public bundles success',
    };
  }

  async findOne(userId: string, id: string) {
    const merchant = await this.findMerchant(this.dataSource.manager, userId);
    await this.findOwnedBundle(this.dataSource.manager, merchant.id, id);

    return {
      data: await this.findResponse(id),
      responseMessage: 'Get bundle success',
    };
  }

  async update(userId: string, id: string, input: UpdateBundleDto) {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      const bundle = await this.findOwnedBundle(manager, merchant.id, id);

      const main = await applyCoverInput(
        manager,
        { bundleId: id },
        input,
        bundle.coverAssetId,
        (assetId) =>
          assertOwnedAsset(manager, userId, assetId, 'product_cover'),
      );
      if (main !== undefined) bundle.coverAssetId = main;
      if (input.title !== undefined) bundle.title = input.title;
      if (input.description !== undefined) {
        bundle.description = input.description;
      }
      if (input.bundle_price !== undefined) {
        bundle.bundlePrice = String(input.bundle_price);
      }
      if (input.post_purchase_instructions !== undefined) {
        bundle.postPurchaseInstructions = input.post_purchase_instructions;
      }
      if (input.status !== undefined) bundle.status = input.status;

      // Validate the final state: replaced items, or the stored ones.
      const itemInputs =
        input.items ?? (await this.currentItemInputs(manager, bundle.id));
      const items = await this.resolveItems(manager, merchant.id, itemInputs);
      this.assertSellable(items, bundle.status, Number(bundle.bundlePrice));

      await manager.save(Bundle, bundle);
      if (input.items !== undefined) {
        await manager.delete(BundleItem, { bundleId: bundle.id });
        await this.insertItems(manager, bundle.id, items);
      }
    });

    return {
      data: await this.findResponse(id),
      responseMessage: 'Update bundle success',
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const merchant = await this.findMerchant(manager, userId, true);
      const bundle = await this.findOwnedBundle(manager, merchant.id, id);
      await manager.softRemove(Bundle, bundle);
    });
  }

  // Locking the merchant row serializes every bundle write of one merchant.
  private async findMerchant(
    manager: EntityManager,
    userId: string,
    lock = false,
  ): Promise<Merchant> {
    const merchant = await manager.findOne(Merchant, {
      where: { userId },
      lock: lock ? { mode: 'pessimistic_write' } : undefined,
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant;
  }

  private async findOwnedBundle(
    manager: EntityManager,
    merchantId: string,
    id: string,
  ): Promise<Bundle> {
    const bundle = await manager.findOneBy(Bundle, { id, merchantId });
    if (!bundle) throw new NotFoundException('Bundle not found');
    return bundle;
  }

  private async resolveItems(
    manager: EntityManager,
    merchantId: string,
    inputs: BundleItemInputDto[],
  ): Promise<CatalogRow[]> {
    const keys = inputs.map((input) => `${input.type}:${input.id}`);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Bundle items must be distinct');
    }

    const rows: CatalogRow[] = await manager.query(
      `SELECT * FROM (${CATALOG_SQL}) catalog WHERE catalog.id = ANY($2::uuid[])`,
      [merchantId, inputs.map((input) => input.id)],
    );
    const byKey = new Map(rows.map((row) => [`${row.type}:${row.id}`, row]));

    return inputs.map((input) => {
      const row = byKey.get(`${input.type}:${input.id}`);
      if (!row) {
        throw new BadRequestException(
          `Item ${input.type}:${input.id} is not one of your classes or digital products`,
        );
      }
      return row;
    });
  }

  private assertSellable(
    items: CatalogRow[],
    status: BundleStatus,
    bundlePrice: number,
  ): void {
    if (items.length < 2) {
      throw new BadRequestException('A bundle needs at least two items');
    }
    if (
      PUBLIC_STATUSES.includes(status) &&
      items.some((item) => !item.is_available)
    ) {
      throw new BadRequestException(
        'Every item must be published before the bundle can be published or unlisted',
      );
    }

    const total = sumPrices(items);
    if (!(bundlePrice > 0 && bundlePrice < total)) {
      throw new BadRequestException(
        `bundle_price must be greater than 0 and lower than the items total (${total})`,
      );
    }
  }

  private async insertItems(
    manager: EntityManager,
    bundleId: string,
    items: CatalogRow[],
  ): Promise<void> {
    await manager.save(
      BundleItem,
      items.map((item, index) =>
        manager.create(BundleItem, {
          bundleId,
          classId: item.type === 'kelas' ? item.id : null,
          productId: item.type === 'digital' ? item.id : null,
          displayOrder: index,
        }),
      ),
    );
  }

  private async currentItemInputs(
    manager: EntityManager,
    bundleId: string,
  ): Promise<BundleItemInputDto[]> {
    const items = await manager.find(BundleItem, {
      where: { bundleId },
      order: { displayOrder: 'ASC' },
    });
    return items.map((item) =>
      item.classId
        ? { type: 'kelas', id: item.classId }
        : { type: 'digital', id: item.productId },
    );
  }

  private async findResponse(id: string): Promise<BundleResponseDto> {
    const rows: BundleRow[] = await this.dataSource.query(
      `${BUNDLE_SELECT_SQL} WHERE bundle.id = $1`,
      [id],
    );
    const [response] = await this.toResponses(rows);
    return response;
  }

  private async toResponses(rows: BundleRow[]): Promise<BundleResponseDto[]> {
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const [itemRows, salesRows, covers] = await Promise.all([
      this.dataSource.query(
        `SELECT item.bundle_id,
                COALESCE(class.id, product.id) AS id,
                CASE WHEN item.class_id IS NOT NULL THEN 'kelas' ELSE 'digital' END AS type,
                class.type AS class_type,
                COALESCE(class.title, product.title) AS title,
                CASE WHEN item.class_id IS NOT NULL THEN ${CLASS_PRICE_SQL} ELSE ${PRODUCT_PRICE_SQL} END AS price,
                cover.object_key AS image,
                CASE WHEN item.class_id IS NOT NULL
                  THEN class.status IN ('published', 'archived') AND class.deleted_at IS NULL
                  ELSE product.is_published AND product.deleted_at IS NULL
                END AS is_available
         FROM bundle_items item
         LEFT JOIN classes class ON class.id = item.class_id
         LEFT JOIN products product ON product.id = item.product_id
         LEFT JOIN file_assets cover
           ON cover.id = COALESCE(class.cover_asset_id, product.cover_asset_id)
           AND cover.deleted_at IS NULL
         WHERE item.bundle_id = ANY($1::uuid[])
         ORDER BY item.bundle_id, item.display_order`,
        [ids],
      ) as Promise<BundleItemRow[]>,
      this.dataSource.query(
        `SELECT item.bundle_id, count(*)::integer AS sales
         FROM order_items item
         INNER JOIN orders purchase ON purchase.id = item.order_id
         WHERE item.bundle_id = ANY($1::uuid[]) AND purchase.status = 'paid'
           AND item.deleted_at IS NULL AND purchase.deleted_at IS NULL
         GROUP BY item.bundle_id`,
        [ids],
      ) as Promise<{ bundle_id: string; sales: number }[]>,
      findCovers(this.dataSource, 'bundle', ids),
    ]);

    const salesByBundle = new Map(
      salesRows.map((row) => [row.bundle_id, row.sales]),
    );

    return rows.map((row) => {
      const items = itemRows.filter((item) => item.bundle_id === row.id);
      const originalTotal = sumPrices(items);
      const bundlePrice = Number(row.bundle_price);
      const saving = Math.max(originalTotal - bundlePrice, 0);

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        cover_asset_id: row.cover_asset_id,
        cover_object_key: row.cover_object_key,
        covers: covers.get(row.id) ?? [],
        items: items.map((item) => this.toItem(item)),
        original_total: originalTotal,
        bundle_price: bundlePrice,
        saving_amount: saving,
        saving_percent:
          originalTotal > 0 ? Math.round((saving / originalTotal) * 100) : 0,
        sales_count: salesByBundle.get(row.id) ?? 0,
        status: row.status,
        post_purchase_instructions: row.post_purchase_instructions,
        created_at: row.created_at,
      };
    });
  }

  private toItem(row: CatalogRow): BundleItemResponseDto {
    return {
      id: row.id,
      type: row.type,
      class_type: row.class_type,
      title: row.title,
      price: Number(row.price),
      image: row.image,
      is_available: row.is_available,
    };
  }
}

const BUNDLE_SELECT_SQL = `
  SELECT bundle.id, bundle.merchant_id, bundle.title, bundle.description, bundle.cover_asset_id,
         cover.object_key AS cover_object_key, bundle.bundle_price, bundle.status,
         bundle.post_purchase_instructions, bundle.created_at
  FROM bundles bundle
  LEFT JOIN file_assets cover
    ON cover.id = bundle.cover_asset_id AND cover.deleted_at IS NULL
`;

function sumPrices(items: { price: string | number }[]): number {
  return items.reduce((total, item) => total + Number(item.price), 0);
}
