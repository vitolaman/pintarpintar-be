import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Merchant } from '../merchant/entities/merchant.entity';
import { Product } from '../profile/entities/product.entity';
import { DigitalProductService } from './digital-product.service';
import {
  CreateDigitalProductDto,
  DigitalProductListQueryDto,
} from './dto/digital-product-request.dto';
import { Category } from './entities/category.entity';
import { DigitalFile } from './entities/digital-file.entity';
import { ProductCategory } from './entities/product-category.entity';

const USER = '10000000-0000-4000-8000-000000000001';
const MERCHANT = '20000000-0000-4000-8000-000000000001';
const PRODUCT = '80000000-0000-4000-8000-000000000001';
const FILE_ASSET = '40000000-0000-4000-8000-000000000001';

const detailRow = {
  id: PRODUCT,
  title: 'Template RAB',
  description: null,
  cover_asset_id: null,
  cover_object_key: null,
  original_price: '150000',
  discount_price: '99000',
  status: 'published',
  is_published: true,
  published_at: new Date('2026-09-30T00:00:00Z'),
  post_purchase_instructions: null,
  created_at: new Date('2026-09-30T00:00:00Z'),
  updated_at: new Date('2026-09-30T00:00:00Z'),
  category_id: 'category-id',
  category_name: 'Excel',
  category_slug: 'excel',
  file_asset_id: FILE_ASSET,
  file_format: 'xlsx',
  file_size: 2048,
  file_url: 'uploads/1-rab.xlsx',
  file_name: 'rab.xlsx',
  file_object_key: 'uploads/1-rab.xlsx',
  downloads: 4,
  rating: '4.25',
  review_count: 2,
  revenue: '396000',
};

const fileAsset = {
  id: FILE_ASSET,
  uploadedByUserId: USER,
  status: 'active',
  visibility: 'private',
  objectKey: 'uploads/1-rab.xlsx',
  originalFilename: 'rab.xlsx',
  mimeType: 'application/octet-stream',
  sizeBytes: '2048',
};

describe('DigitalProductService', () => {
  let merchant: { id: string } | null;
  let owned: Record<string, unknown> | null;
  let category: { id: string } | null;
  let asset: Record<string, unknown>;
  let hasFile: boolean;
  let inBundle: boolean;
  let manager: Record<string, jest.Mock>;
  let service: DigitalProductService;

  const sqlCalls = (fragment: string) =>
    manager.query.mock.calls.filter(([sql]) => String(sql).includes(fragment));
  const savedProduct = () =>
    manager.save.mock.calls.find(([entity]) => entity === Product)?.[1];

  beforeEach(() => {
    merchant = { id: MERCHANT };
    owned = {
      id: PRODUCT,
      merchantId: MERCHANT,
      originalPrice: '150000',
      discountPrice: '0',
      publicationStatus: 'unpublished',
      isPublished: false,
      publishedAt: null,
    };
    category = { id: 'category-id' };
    asset = fileAsset;
    hasFile = false;
    inBundle = false;
    manager = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('used_bytes')) {
          return [{ used_bytes: '0', counted: false }];
        }
        if (sql.includes('FROM bundle_items')) return inBundle ? [{}] : [];
        if (sql.includes('count(*)::integer AS total')) return [{ total: 1 }];
        if (sql.includes('ORDER BY created_at DESC')) return [{ id: PRODUCT }];
        if (sql.includes('WHERE product.id = ANY')) return [detailRow];
        return [];
      }),
      findOne: jest.fn(async (entity) =>
        entity === Merchant ? merchant : owned && { ...owned },
      ),
      findOneBy: jest.fn(async (entity) => {
        if (entity === Category) return category;
        if (entity === Merchant) return { ...merchant, storageLevel: 'basic' };
        return asset;
      }),
      create: jest.fn((_entity, value) => ({ ...value })),
      save: jest.fn(async (_entity, value) => ({ id: PRODUCT, ...value })),
      exists: jest.fn(async () => hasFile),
      upsert: jest.fn(),
      delete: jest.fn(),
      softDelete: jest.fn(),
    };
    const dataSource = {
      manager,
      transaction: jest.fn((callback) => callback(manager)),
    };
    service = new DigitalProductService(
      dataSource as never,
      new ConfigService({
        AWS_S3_BUCKET_NAME: 'bucket',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test',
        AWS_SECRET_ACCESS_KEY: 'test',
      }),
    );
  });

  const create = (input: Partial<CreateDigitalProductDto> = {}) =>
    service.create(USER, {
      title: 'Template RAB',
      category_slug: 'excel',
      original_price: 150000,
      status: 'unpublished',
      ...input,
    });

  it('lists only the caller merchant products with sales figures', async () => {
    const response = await service.findAll(USER, { page: 1, limit: 10 });

    const [, params] = sqlCalls('count(*)::integer AS total')[0];
    expect(params[0]).toBe(MERCHANT);
    expect(response.data[0]).toMatchObject({
      price: 99000,
      downloads: 4,
      rating: 4.3,
      revenue: 396000,
      category: { slug: 'excel' },
      file: { format: 'XLSX', size: 2048, download_url: null },
    });
  });

  it('returns 404 for a user without a merchant', async () => {
    merchant = null;

    await expect(service.findAll(USER, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a published product through its entities', async () => {
    const response = await create({
      status: 'published',
      discount_price: 99000,
      file_asset_id: FILE_ASSET,
    });

    expect(savedProduct()).toMatchObject({
      merchantId: MERCHANT,
      title: 'Template RAB',
      originalPrice: '150000',
      discountPrice: '99000',
      currency: 'IDR',
      productType: 'digital',
      publicationStatus: 'published',
      isPublished: true,
      publishedAt: expect.any(Date),
    });
    expect(manager.upsert).toHaveBeenCalledWith(
      ProductCategory,
      { productId: PRODUCT, categoryId: 'category-id', deleted_at: null },
      ['productId', 'categoryId'],
    );
    expect(manager.upsert).toHaveBeenCalledWith(
      DigitalFile,
      {
        productId: PRODUCT,
        fileUrl: 'uploads/1-rab.xlsx',
        fileFormat: 'xlsx',
        fileSize: 2048,
        assetId: FILE_ASSET,
        deleted_at: null,
      },
      ['productId'],
    );
    expect(response.data.file.download_url).toContain('X-Amz-Signature');
  });

  it('keeps a draft unpublished without a publication date', async () => {
    await create();

    expect(savedProduct()).toMatchObject({
      publicationStatus: 'unpublished',
      isPublished: false,
      publishedAt: null,
    });
    expect(
      manager.upsert.mock.calls.some(([entity]) => entity === DigitalFile),
    ).toBe(false);
  });

  it.each([
    ['publishing without a file', { status: 'published' as const }],
    ['a discount above the list price', { discount_price: 200000 }],
  ])('rejects %s', async (_label, input) => {
    await expect(create(input)).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects an unknown category', async () => {
    category = null;

    await expect(create({ category_slug: 'keuangan' })).rejects.toThrow(
      'Unknown category',
    );
  });

  it("rejects another user's upload as the product file", async () => {
    asset = { ...fileAsset, uploadedByUserId: 'someone-else' };

    await expect(create({ file_asset_id: FILE_ASSET })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a cover image used as the product file', async () => {
    asset = {
      ...fileAsset,
      visibility: 'public',
      originalFilename: 'cover.png',
      mimeType: 'image/png',
    };

    await expect(create({ file_asset_id: FILE_ASSET })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('publishes an existing product only once it has a file', async () => {
    await expect(
      service.update(USER, PRODUCT, { status: 'published' }),
    ).rejects.toThrow('A product file is required to publish');

    hasFile = true;
    await service.update(USER, PRODUCT, { status: 'published' });
    expect(savedProduct()).toMatchObject({
      publicationStatus: 'published',
      isPublished: true,
      publishedAt: expect.any(Date),
    });
  });

  it('keeps the first publication date when republishing', async () => {
    const firstPublished = new Date('2026-01-01T00:00:00Z');
    owned = { ...owned, publishedAt: firstPublished };
    hasFile = true;

    await service.update(USER, PRODUCT, { status: 'published' });

    expect(savedProduct().publishedAt).toBe(firstPublished);
  });

  it('replaces the category by removing the other links', async () => {
    await service.update(USER, PRODUCT, { category_slug: 'excel' });

    expect(manager.delete).toHaveBeenCalledWith(
      ProductCategory,
      expect.objectContaining({ productId: PRODUCT }),
    );
  });

  it('checks a new discount against the stored list price', async () => {
    await expect(
      service.update(USER, PRODUCT, { discount_price: 200000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns 404 for another merchant's product", async () => {
    owned = null;

    await expect(
      service.update(USER, PRODUCT, { title: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(USER, PRODUCT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses to delete a product of an active bundle', async () => {
    inBundle = true;

    await expect(service.remove(USER, PRODUCT)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.softDelete).not.toHaveBeenCalled();
  });

  it('soft-deletes the product and leaves buyer access alone', async () => {
    await service.remove(USER, PRODUCT);

    expect(savedProduct()).toMatchObject({ isPublished: false });
    expect(manager.softDelete).toHaveBeenCalledWith(Product, { id: PRODUCT });
    expect(sqlCalls('user_access')).toEqual([]);
  });
});

describe('digital product DTO validation', () => {
  async function errorFields(target: new () => object, input: object) {
    const errors = await validate(plainToInstance(target, input));
    return errors.map((error) => error.property);
  }

  const valid = {
    title: 'Template',
    category_slug: 'template-canva',
    original_price: 50000,
    status: 'unlisted',
  };

  it.each([
    [{ ...valid, status: 'Published' }, ['status']],
    [{ ...valid, category_slug: 'Template Canva' }, ['category_slug']],
    [{ ...valid, original_price: -1 }, ['original_price']],
    [{ ...valid, discount_price: -1 }, ['discount_price']],
    [{ ...valid, file_asset_id: 'x' }, ['file_asset_id']],
    [{ ...valid, title: '   ' }, ['title']],
    [valid, []],
  ])('create %j fails on %j', async (input, fields) => {
    expect(await errorFields(CreateDigitalProductDto, input)).toEqual(fields);
  });

  it.each([
    [{ limit: '101' }, []],
    [{ status: 'draft' }, ['status']],
    [{ status: 'unlisted', limit: '100', search: 'rab' }, []],
  ])('list query %j fails on %j', async (input, fields) => {
    expect(await errorFields(DigitalProductListQueryDto, input)).toEqual(
      fields,
    );
  });
});
