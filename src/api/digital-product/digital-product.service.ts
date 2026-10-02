import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not } from 'typeorm';
import { assertDiscountWithinPrice } from '../../common/pricing/discount-rule';
import { assetUrl } from '../../common/storage/asset-url';
import {
  ObjectStorage,
  createObjectStorage,
} from '../../common/storage/object-storage';
import { signedDownloadUrl } from '../../common/storage/signed-download-url';
import {
  assertOwnedAsset,
  fileExtension,
} from '../file-asset/asset-purpose-rules';
import { Merchant } from '../merchant/entities/merchant.entity';
import { FileAsset } from '../profile/entities/file-asset.entity';
import { Product } from '../profile/entities/product.entity';
import {
  CreateDigitalProductDto,
  DigitalProductListQueryDto,
  ProductStatus,
  UpdateDigitalProductDto,
} from './dto/digital-product-request.dto';
import { DigitalProductResponseDto } from './dto/digital-product-response.dto';
import { Category } from './entities/category.entity';
import { DigitalFile } from './entities/digital-file.entity';
import { ProductCategory } from './entities/product-category.entity';
import { applyCoverInput, findCovers } from '../item-cover/item-covers';
import { ItemCoverDto } from '../item-cover/dto/item-cover.dto';
import { paginationMeta } from '~/common/dto/response-meta.dto';

const PRICE_FIELDS = { list: 'original_price', discount: 'discount_price' };

// Details, sales figures, and the single file for the given product ids.
// Downloads count learners with access; revenue is the net of paid order
// items (price minus code discount shares).
const PRODUCT_DETAILS_SQL = `
  SELECT product.id, product.title, product.description, product.cover_asset_id,
         cover.object_key AS cover_object_key,
         COALESCE(product.original_price, 0) AS original_price, product.discount_price,
         product.publication_status AS status, product.is_published, product.published_at,
         product.post_purchase_instructions, product.created_at, product.updated_at,
         category.id AS category_id, category.name AS category_name, category.slug AS category_slug,
         file.asset_id AS file_asset_id, file.file_format, file.file_size, file.file_url,
         file_asset.original_filename AS file_name, file_asset.object_key AS file_object_key,
         access.downloads, review.rating, review.review_count, sales.revenue
  FROM products product
  LEFT JOIN file_assets cover ON cover.id = product.cover_asset_id AND cover.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT category.id, category.name, category.slug
    FROM product_categories link
    INNER JOIN categories category ON category.id = link.category_id AND category.deleted_at IS NULL
    WHERE link.product_id = product.id AND link.deleted_at IS NULL
    ORDER BY link.updated_at DESC, category.name
    LIMIT 1
  ) category ON true
  LEFT JOIN digital_files file ON file.product_id = product.id AND file.deleted_at IS NULL
  LEFT JOIN file_assets file_asset ON file_asset.id = file.asset_id AND file_asset.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT user_id)::integer AS downloads
    FROM user_access WHERE product_id = product.id AND deleted_at IS NULL
  ) access ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(avg(rating), 0) AS rating, count(*)::integer AS review_count
    FROM reviews WHERE product_id = product.id AND deleted_at IS NULL
  ) review ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(sum(item.price_at_purchase - item.discount_amount), 0) AS revenue
    FROM order_items item
    INNER JOIN orders purchase
      ON purchase.id = item.order_id AND purchase.deleted_at IS NULL AND purchase.status = 'paid'
    WHERE item.product_id = product.id AND item.deleted_at IS NULL
  ) sales ON true
  WHERE product.id = ANY($1::uuid[])
`;

const OWN_PRODUCTS_FILTER = `
  FROM products
  WHERE merchant_id = $1 AND deleted_at IS NULL AND product_type = 'digital'
    AND ($2::text IS NULL OR publication_status = $2)
    AND ($3::text IS NULL OR title ILIKE '%' || $3 || '%' ESCAPE '\\')
`;

interface ProductRow {
  id: string;
  title: string;
  description: string | null;
  cover_asset_id: string | null;
  cover_object_key: string | null;
  original_price: string;
  discount_price: string;
  status: ProductStatus;
  is_published: boolean;
  published_at: Date | null;
  post_purchase_instructions: string | null;
  created_at: Date;
  updated_at: Date;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  file_asset_id: string | null;
  file_format: string | null;
  file_size: number | null;
  file_url: string | null;
  file_name: string | null;
  file_object_key: string | null;
  downloads: number;
  rating: string;
  review_count: number;
  revenue: string;
}

// A merchant's own digital products. Writes lock the merchant row, so two
// requests of one merchant never interleave.
@Injectable()
export class DigitalProductService {
  private readonly storage: ObjectStorage;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.storage = createObjectStorage(configService);
  }

  async findAll(userId: string, query: DigitalProductListQueryDto) {
    const manager = this.dataSource.manager;
    const merchantId = await this.findMerchantId(manager, userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filter = [
      merchantId,
      query.status ?? null,
      query.search ? escapeLike(query.search) : null,
    ];

    const [{ total }] = await manager.query(
      `SELECT count(*)::integer AS total ${OWN_PRODUCTS_FILTER}`,
      filter,
    );
    const pageRows: { id: string }[] = await manager.query(
      `SELECT id ${OWN_PRODUCTS_FILTER}
       ORDER BY created_at DESC, id
       LIMIT $4 OFFSET $5`,
      [...filter, limit, (page - 1) * limit],
    );
    const ids = pageRows.map((row) => row.id);
    const rows: ProductRow[] =
      ids.length === 0 ? [] : await manager.query(PRODUCT_DETAILS_SQL, [ids]);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const covers = await findCovers(manager, 'product', ids);

    return {
      data: await Promise.all(
        ids.map((id) => this.toResponse(byId.get(id), false, covers.get(id))),
      ),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get digital products success',
    };
  }

  async findOne(userId: string, id: string) {
    const manager = this.dataSource.manager;
    const merchantId = await this.findMerchantId(manager, userId);
    await this.findOwnedProduct(manager, merchantId, id);
    return {
      data: await this.findResponse(manager, id),
      responseMessage: 'Get digital product success',
    };
  }

  async create(userId: string, input: CreateDigitalProductDto) {
    assertDiscountWithinPrice(
      input.original_price,
      input.discount_price,
      PRICE_FIELDS,
    );

    return this.dataSource.transaction(async (manager) => {
      const merchantId = await this.findMerchantId(manager, userId, true);
      const category = await this.findCategory(manager, input.category_slug);
      const file = input.file_asset_id
        ? await assertOwnedAsset(
            manager,
            userId,
            input.file_asset_id,
            'digital_file',
            { merchantId },
          )
        : null;
      const status = input.status ?? 'unpublished';
      assertPublishable(status, file !== null);

      const product = manager.create(Product, {
        merchantId,
        title: input.title,
        description: input.description ?? null,
        originalPrice: String(input.original_price),
        discountPrice: String(input.discount_price ?? 0),
        currency: 'IDR',
        productType: 'digital',
        postPurchaseInstructions: input.post_purchase_instructions ?? null,
        publishedAt: null,
      });
      applyStatus(product, status);
      const saved = await manager.save(Product, product);
      const main = await applyCoverInput(
        manager,
        { productId: saved.id },
        input,
        null,
        (assetId) =>
          assertOwnedAsset(manager, userId, assetId, 'product_cover'),
      );
      if (main !== undefined) {
        await manager.update(Product, { id: saved.id }, { coverAssetId: main });
      }
      await this.setCategory(manager, saved.id, category.id);
      if (file) await this.setFile(manager, saved.id, file);

      return {
        data: await this.findResponse(manager, saved.id),
        responseMessage: 'Create digital product success',
      };
    });
  }

  async update(userId: string, id: string, input: UpdateDigitalProductDto) {
    return this.dataSource.transaction(async (manager) => {
      const merchantId = await this.findMerchantId(manager, userId, true);
      const product = await this.findOwnedProduct(
        manager,
        merchantId,
        id,
        true,
      );

      if (
        input.original_price !== undefined ||
        input.discount_price !== undefined
      ) {
        assertDiscountWithinPrice(
          input.original_price ?? nullableNumber(product.originalPrice),
          input.discount_price === undefined
            ? Number(product.discountPrice)
            : input.discount_price,
          PRICE_FIELDS,
        );
      }
      const category = input.category_slug
        ? await this.findCategory(manager, input.category_slug)
        : null;
      const main = await applyCoverInput(
        manager,
        { productId: id },
        input,
        product.coverAssetId,
        (assetId) =>
          assertOwnedAsset(manager, userId, assetId, 'product_cover'),
      );
      const file = input.file_asset_id
        ? await assertOwnedAsset(
            manager,
            userId,
            input.file_asset_id,
            'digital_file',
            { merchantId },
          )
        : null;
      const status =
        input.status ?? (product.publicationStatus as ProductStatus);
      const hasFile =
        file !== null ||
        (await manager.exists(DigitalFile, { where: { productId: id } }));
      assertPublishable(status, hasFile);

      if (input.title !== undefined) product.title = input.title;
      if (input.description !== undefined) {
        product.description = input.description;
      }
      if (input.original_price !== undefined) {
        product.originalPrice = String(input.original_price);
      }
      if (input.discount_price !== undefined) {
        product.discountPrice = String(input.discount_price ?? 0);
      }
      if (main !== undefined) product.coverAssetId = main;
      if (input.post_purchase_instructions !== undefined) {
        product.postPurchaseInstructions = input.post_purchase_instructions;
      }
      applyStatus(product, status);
      await manager.save(Product, product);
      if (category) await this.setCategory(manager, id, category.id);
      if (file) await this.setFile(manager, id, file);

      return {
        data: await this.findResponse(manager, id),
        responseMessage: 'Update digital product success',
      };
    });
  }

  // A soft delete: buyers keep their access rows and library entry, while the
  // product leaves listings, the catalog, and new purchases.
  async remove(userId: string, id: string) {
    await this.dataSource.transaction(async (manager) => {
      const merchantId = await this.findMerchantId(manager, userId, true);
      const product = await this.findOwnedProduct(
        manager,
        merchantId,
        id,
        true,
      );

      const inBundle = await manager.query(
        `SELECT 1 FROM bundle_items item
         INNER JOIN bundles bundle
           ON bundle.id = item.bundle_id AND bundle.deleted_at IS NULL
           AND bundle.status IN ('published', 'unlisted')
         WHERE item.product_id = $1 AND item.deleted_at IS NULL
         LIMIT 1`,
        [id],
      );
      if (inBundle.length > 0) {
        throw new ConflictException(
          'Remove this product from its active bundles before deleting it',
        );
      }

      product.isPublished = false;
      await manager.save(Product, product);
      await manager.softDelete(Product, { id });
    });
  }

  private async findMerchantId(
    manager: EntityManager,
    userId: string,
    lock = false,
  ): Promise<string> {
    const merchant = await manager.findOne(Merchant, {
      where: { userId },
      lock: lock ? { mode: 'pessimistic_write' } : undefined,
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant.id;
  }

  private async findOwnedProduct(
    manager: EntityManager,
    merchantId: string,
    id: string,
    lock = false,
  ): Promise<Product> {
    const product = await manager.findOne(Product, {
      where: { id, merchantId, productType: 'digital' },
      lock: lock ? { mode: 'pessimistic_write' } : undefined,
    });
    if (!product) throw new NotFoundException('Digital product not found');
    return product;
  }

  private async findCategory(
    manager: EntityManager,
    slug: string,
  ): Promise<Category> {
    const category = await manager.findOneBy(Category, { slug });
    if (!category) throw new BadRequestException('Unknown category');
    return category;
  }

  // A product has one category. Other links are removed and the chosen one
  // is inserted or revived; (product_id, category_id) is unique across
  // soft-deleted rows, so a replaced link is deleted rather than retired.
  private async setCategory(
    manager: EntityManager,
    productId: string,
    categoryId: string,
  ) {
    await manager.delete(ProductCategory, {
      productId,
      categoryId: Not(categoryId),
    });
    await manager.upsert(
      ProductCategory,
      { productId, categoryId, deleted_at: null },
      ['productId', 'categoryId'],
    );
  }

  // digital_files holds one row per product (UNIQUE product_id); replacing
  // the file overwrites that row.
  private async setFile(
    manager: EntityManager,
    productId: string,
    asset: FileAsset,
  ) {
    await manager.upsert(
      DigitalFile,
      {
        productId,
        fileUrl: asset.objectKey,
        fileFormat: fileExtension(asset.originalFilename) || 'file',
        fileSize: Number(asset.sizeBytes),
        assetId: asset.id,
        deleted_at: null,
      },
      ['productId'],
    );
  }

  private async findResponse(
    manager: EntityManager,
    id: string,
  ): Promise<DigitalProductResponseDto> {
    const [row] = await manager.query(PRODUCT_DETAILS_SQL, [[id]]);
    const covers = await findCovers(manager, 'product', [id]);
    return this.toResponse(row, true, covers.get(id));
  }

  private async toResponse(
    row: ProductRow,
    withDownload: boolean,
    covers: ItemCoverDto[] = [],
  ): Promise<DigitalProductResponseDto> {
    const originalPrice = Number(row.original_price);
    const discountPrice = Number(row.discount_price);
    const hasFile = row.file_format !== null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category_id
        ? {
            id: row.category_id,
            name: row.category_name,
            slug: row.category_slug,
          }
        : null,
      cover_asset_id: row.cover_asset_id,
      cover_url: assetUrl(row.cover_object_key),
      covers,
      original_price: originalPrice,
      discount_price: discountPrice,
      price: discountPrice > 0 ? discountPrice : originalPrice,
      status: row.status,
      is_published: row.is_published,
      published_at: row.published_at,
      file: hasFile
        ? {
            asset_id: row.file_asset_id,
            name: row.file_name ?? row.file_url.split('/').pop(),
            format: row.file_format.toUpperCase(),
            size: Number(row.file_size),
            download_url:
              withDownload && row.file_object_key
                ? await signedDownloadUrl(
                    this.storage,
                    row.file_object_key,
                    row.file_name,
                  )
                : null,
          }
        : null,
      downloads: row.downloads,
      rating: Math.round(Number(row.rating) * 10) / 10,
      review_count: row.review_count,
      revenue: Number(row.revenue),
      post_purchase_instructions: row.post_purchase_instructions,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// is_published mirrors the published status; published_at records the first
// publication.
function applyStatus(product: Product, status: ProductStatus): void {
  product.publicationStatus = status;
  product.isPublished = status === 'published';
  if (product.isPublished && !product.publishedAt) {
    product.publishedAt = new Date();
  }
}

function assertPublishable(status: ProductStatus, hasFile: boolean): void {
  if (status === 'published' && !hasFile) {
    throw new BadRequestException('A product file is required to publish');
  }
}

function nullableNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
