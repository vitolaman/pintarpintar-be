import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { Merchant } from '../merchant/entities/merchant.entity';
import { BundleService } from './bundle.service';
import {
  BundleListQueryDto,
  CreateBundleDto,
  PublicBundleQueryDto,
  UpdateBundleDto,
} from './dto/bundle-request.dto';
import { BundleItem } from './entities/bundle-item.entity';
import { Bundle } from './entities/bundle.entity';

const CLASS_ID = '10000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000002';
const BUNDLE_ID = '10000000-0000-4000-8000-000000000003';

const catalog = {
  autocad: {
    id: CLASS_ID,
    type: 'kelas',
    title: 'Belajar AutoCAD dari Nol',
    price: '299000',
    image: null,
    is_available: true,
  },
  bim: {
    id: '10000000-0000-4000-8000-000000000004',
    type: 'bootcamp',
    title: 'Bootcamp BIM',
    price: '450000',
    image: null,
    is_available: true,
  },
  template: {
    id: PRODUCT_ID,
    type: 'digital',
    title: 'Template RAB Excel',
    price: '125000',
    image: 'products/covers/rab.png',
    is_available: true,
  },
};

describe('CreateBundleDto', () => {
  const valid = {
    title: 'Paket AutoCAD & RAB',
    description: 'Kelas plus template.',
    price: 349000,
    items: [
      { type: 'kelas', id: CLASS_ID },
      { type: 'digital', id: PRODUCT_ID },
    ],
  };
  const errorsFor = (override: Record<string, unknown>) =>
    validate(plainToInstance(CreateBundleDto, { ...valid, ...override }));

  it('accepts a valid bundle', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });

  it.each([
    [{ items: [{ type: 'kelas', id: CLASS_ID }] }],
    [{ items: [{ type: 'bundle', id: CLASS_ID }, valid.items[1]] }],
    [{ price: 0 }],
    [{ title: '' }],
    [{ status: 'active' }],
    [{ status: null }],
    [{ description: '  ' }],
  ])('rejects %j', async (override) => {
    expect(await errorsFor(override)).not.toHaveLength(0);
  });

  it('accepts a numeric price string and a status in any case', async () => {
    const dto = plainToInstance(CreateBundleDto, {
      ...valid,
      price: '349000',
      status: ' Unlisted ',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ price: 349000, status: 'unlisted' });
  });

  it.each([CreateBundleDto, UpdateBundleDto])(
    '%p rejects the old bundle_price field',
    async (target: new () => object) => {
      // The create body is otherwise valid, so the old name is the only error.
      const body =
        target === CreateBundleDto
          ? { ...valid, bundle_price: valid.price }
          : { bundle_price: valid.price };
      const errors = await validate(plainToInstance(target, body), {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors.map((error) => error.property)).toEqual(['bundle_price']);
    },
  );

  it('accepts the price under strict validation', async () => {
    const errors = await validate(plainToInstance(CreateBundleDto, valid), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toEqual([]);
  });

  it('rejects an item class_type under strict validation', async () => {
    const errors = await validate(
      plainToInstance(CreateBundleDto, {
        ...valid,
        items: [
          { type: 'kelas', class_type: 'video', id: CLASS_ID },
          valid.items[1],
        ],
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );

    expect(errors.map((error) => error.property)).toEqual(['items']);
  });

  it('clears the post-purchase instructions with "" or null', async () => {
    for (const value of ['', null]) {
      const dto = plainToInstance(UpdateBundleDto, {
        post_purchase_instructions: value,
      });
      expect(await validate(dto)).toEqual([]);
      expect(dto.post_purchase_instructions).toBeNull();
    }
  });

  it.each(['', '  ', null])(
    'rejects a title or description of %j on update',
    async (value) => {
      const errors = await validate(
        plainToInstance(UpdateBundleDto, { title: value, description: value }),
      );
      expect(errors.map((error) => error.property)).toEqual([
        'title',
        'description',
      ]);
    },
  );
});

describe('bundle list queries', () => {
  it('treats blank filters as no filter and matches the status in any case', async () => {
    const blank = plainToInstance(BundleListQueryDto, { status: ' ' });
    expect(await validate(blank)).toEqual([]);
    expect(blank.status).toBeUndefined();

    const published = plainToInstance(BundleListQueryDto, {
      status: 'PUBLISHED',
    });
    expect(await validate(published)).toEqual([]);
    expect(published.status).toBe('published');

    const anyMerchant = plainToInstance(PublicBundleQueryDto, {
      merchant_id: '',
    });
    expect(await validate(anyMerchant)).toEqual([]);
    expect(anyMerchant.merchant_id).toBeUndefined();
  });
});

describe('BundleService', () => {
  const merchant = { id: 'merchant-id', userId: 'user-id' } as Merchant;
  let manager: Record<string, jest.Mock>;
  let dataSourceQuery: jest.Mock;
  let service: BundleService;

  const input = (override: Partial<CreateBundleDto> = {}): CreateBundleDto =>
    ({
      title: 'Paket AutoCAD & RAB',
      description: 'Kelas plus template.',
      price: 349000,
      items: [
        { type: 'kelas', id: CLASS_ID },
        { type: 'digital', id: PRODUCT_ID },
      ],
      ...override,
    }) as CreateBundleDto;

  beforeEach(() => {
    manager = {
      findOne: jest.fn(async (target) =>
        target === Merchant ? merchant : null,
      ),
      findOneBy: jest.fn(),
      find: jest.fn(),
      query: jest.fn(async () => [catalog.autocad, catalog.template]),
      create: jest.fn((_target, value) => ({ ...value })),
      save: jest.fn(async (target, value) =>
        target === Bundle ? { id: BUNDLE_ID, ...value } : value,
      ),
      delete: jest.fn(),
      softRemove: jest.fn(),
    };
    dataSourceQuery = jest.fn(async (sql: string) => {
      if (sql.includes('FROM bundles bundle')) {
        return [
          {
            id: BUNDLE_ID,
            title: 'Paket AutoCAD & RAB',
            description: 'Kelas plus template.',
            cover_asset_id: null,
            cover_object_key: null,
            bundle_price: '349000',
            status: 'published',
            post_purchase_instructions: null,
            created_at: new Date('2026-09-30T00:00:00Z'),
          },
        ];
      }
      if (sql.includes('FROM bundle_items item')) {
        return [
          { bundle_id: BUNDLE_ID, ...catalog.autocad },
          { bundle_id: BUNDLE_ID, ...catalog.template },
        ];
      }
      if (sql.includes('count(*)::integer AS sales')) {
        return [{ bundle_id: BUNDLE_ID, sales: 2 }];
      }
      return [];
    });
    service = new BundleService({
      manager,
      query: dataSourceQuery,
      transaction: jest.fn((callback) => callback(manager)),
    } as unknown as DataSource);
  });

  it('creates a bundle with ordered items and derived values', async () => {
    const { data } = await service.create('user-id', input());

    expect(manager.findOne).toHaveBeenCalledWith(Merchant, {
      where: { userId: 'user-id' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.save).toHaveBeenCalledWith(BundleItem, [
      expect.objectContaining({
        classId: CLASS_ID,
        productId: null,
        displayOrder: 0,
      }),
      expect.objectContaining({
        classId: null,
        productId: PRODUCT_ID,
        displayOrder: 1,
      }),
    ]);
    expect(data).toMatchObject({
      original_price: 424000,
      price: 349000,
      discount_amount: 75000,
      discount_percent: 18,
      sales_count: 2,
      status: 'published',
    });
    for (const oldName of [
      'original_total',
      'bundle_price',
      'saving_amount',
      'saving_percent',
      'cover_object_key',
    ]) {
      expect(data).not.toHaveProperty(oldName);
    }
    expect(data.items.map((item) => item.type)).toEqual(['kelas', 'digital']);
    expect(data.items[0]).not.toHaveProperty('class_type');
  });

  it('reports eligible classes as kelas or bootcamp, after digital products', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      catalog.template,
      catalog.autocad,
      catalog.bim,
    ]);

    const { data } = await service.findEligibleItems('user-id');

    expect(data.map((item) => item.type)).toEqual([
      'digital',
      'kelas',
      'bootcamp',
    ]);
    const [sql] = dataSourceQuery.mock.calls[0];
    expect(sql).toContain(
      "(CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END) AS type",
    );
    expect(sql).toContain("ORDER BY catalog.type <> 'digital', catalog.title");
  });

  it('stores a bootcamp item as a class and reports it as bootcamp', async () => {
    manager.query.mockResolvedValue([catalog.bim, catalog.template]);
    dataSourceQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM bundles bundle')) {
        return [
          {
            id: BUNDLE_ID,
            title: 'Paket BIM',
            description: 'Bootcamp plus template.',
            cover_asset_id: null,
            cover_object_key: null,
            bundle_price: '500000',
            status: 'unpublished',
            post_purchase_instructions: null,
            created_at: new Date('2026-09-30T00:00:00Z'),
          },
        ];
      }
      if (sql.includes('FROM bundle_items item')) {
        return [
          { bundle_id: BUNDLE_ID, ...catalog.bim },
          { bundle_id: BUNDLE_ID, ...catalog.template },
        ];
      }
      return [];
    });

    const { data } = await service.create(
      'user-id',
      input({
        price: 500000,
        items: [{ type: 'bootcamp', id: catalog.bim.id }, { id: PRODUCT_ID }],
      }),
    );

    expect(manager.save).toHaveBeenCalledWith(BundleItem, [
      expect.objectContaining({ classId: catalog.bim.id, productId: null }),
      expect.objectContaining({ classId: null, productId: PRODUCT_ID }),
    ]);
    expect(data.items.map((item) => item.type)).toEqual([
      'bootcamp',
      'digital',
    ]);
  });

  it('rejects duplicate items', async () => {
    await expect(
      service.create(
        'user-id',
        input({
          items: [
            { type: 'kelas', id: CLASS_ID },
            { type: 'kelas', id: CLASS_ID },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects items that are not the merchant own catalog', async () => {
    manager.query.mockResolvedValueOnce([catalog.autocad]);
    await expect(service.create('user-id', input())).rejects.toThrow(
      /not one of your classes or digital products/,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('resolves items sent by id alone, and bootcamp for a class', async () => {
    await service.create(
      'user-id',
      input({ items: [{ id: CLASS_ID }, { id: PRODUCT_ID }] }),
    );
    await service.create(
      'user-id',
      input({
        items: [{ type: 'bootcamp', id: CLASS_ID }, { id: PRODUCT_ID }],
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      BundleItem,
      expect.arrayContaining([
        expect.objectContaining({ classId: CLASS_ID, productId: null }),
      ]),
    );
  });

  it('rejects an item of another family, naming it', async () => {
    await expect(
      service.create(
        'user-id',
        input({
          items: [{ type: 'digital', id: CLASS_ID }, { id: PRODUCT_ID }],
        }),
      ),
    ).rejects.toThrow(`Item ${CLASS_ID} is a class, not digital`);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects publishing with an unavailable item but allows unpublished', async () => {
    manager.query.mockResolvedValue([
      { ...catalog.autocad, is_available: false },
      catalog.template,
    ]);

    await expect(
      service.create('user-id', input({ status: 'published' })),
    ).rejects.toThrow(/must be published/);
    await expect(service.create('user-id', input())).resolves.toBeDefined();
  });

  it('creates an unpublished bundle when no status is sent', async () => {
    await service.create('user-id', input());

    expect(manager.create).toHaveBeenCalledWith(
      Bundle,
      expect.objectContaining({ status: 'unpublished' }),
    );
  });

  it.each([[424000], [500000]])(
    'rejects a bundle price of %i (not below the total)',
    async (price) => {
      await expect(service.create('user-id', input({ price }))).rejects.toThrow(
        /^price must be .* lower than the items total \(424000\)/,
      );
    },
  );

  it('validates the stored items when only the price changes', async () => {
    manager.findOneBy.mockResolvedValue({
      id: BUNDLE_ID,
      merchantId: 'merchant-id',
      bundlePrice: '349000',
      status: 'published',
    });
    manager.find.mockResolvedValue([
      { classId: CLASS_ID, productId: null },
      { classId: null, productId: PRODUCT_ID },
    ]);

    await expect(
      service.update('user-id', BUNDLE_ID, { price: 430000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.delete).not.toHaveBeenCalled();
  });

  it('hides other merchants bundles behind 404', async () => {
    manager.findOneBy.mockResolvedValue(null);
    await expect(service.remove('user-id', BUNDLE_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.findOneBy).toHaveBeenCalledWith(Bundle, {
      id: BUNDLE_ID,
      merchantId: 'merchant-id',
    });
  });

  describe('image URLs', () => {
    const coverKey = 'bundles/covers/paket.png';

    beforeEach(() => {
      process.env.ASSET_PUBLIC_BASE_URL = 'https://cdn.test/';
      const listQuery = dataSourceQuery.getMockImplementation();
      dataSourceQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('count(*)::integer AS total')) return [{ total: 1 }];
        const rows = await listQuery(sql);
        return sql.includes('FROM bundles bundle')
          ? rows.map((row) => ({
              ...row,
              merchant_id: 'merchant-id',
              cover_asset_id: 'cover-id',
              cover_object_key: coverKey,
            }))
          : rows;
      });
    });

    afterEach(() => {
      delete process.env.ASSET_PUBLIC_BASE_URL;
    });

    const expectItemUrls = (items: { image_url: string | null }[]) => {
      expect(items.map((item) => item.image_url)).toEqual([
        null,
        'https://cdn.test/products/covers/rab.png',
      ]);
    };

    it('adds image_url to eligible items', async () => {
      dataSourceQuery.mockResolvedValueOnce([
        catalog.autocad,
        catalog.template,
      ]);

      const { data } = await service.findEligibleItems('user-id');

      expectItemUrls(data);
      expect(data[1]).not.toHaveProperty('image');
    });

    it('adds cover_url and item image_url to the list and the detail', async () => {
      manager.findOneBy.mockResolvedValue({ id: BUNDLE_ID });

      const list = await service.findAll('user-id', { page: 1, limit: 10 });
      const detail = await service.findOne('user-id', BUNDLE_ID);

      for (const bundle of [list.data[0], detail.data]) {
        expect(bundle).toMatchObject({
          cover_asset_id: 'cover-id',
          cover_url: `https://cdn.test/${coverKey}`,
        });
        expect(bundle).not.toHaveProperty('cover_object_key');
        expectItemUrls(bundle.items);
      }
    });

    it('adds cover_url and item image_url to public bundles', async () => {
      const { data } = await service.findPublic({ page: 1, limit: 12 });

      expect(data[0].cover_url).toBe(`https://cdn.test/${coverKey}`);
      expect(data[0]).not.toHaveProperty('cover_asset_id');
      expect(data[0]).not.toHaveProperty('cover_object_key');
      expectItemUrls(data[0].items);
    });

    it('returns null URLs without a public base URL', async () => {
      delete process.env.ASSET_PUBLIC_BASE_URL;
      manager.findOneBy.mockResolvedValue({ id: BUNDLE_ID });

      const { data } = await service.findOne('user-id', BUNDLE_ID);

      expect(data.cover_url).toBeNull();
      expect(data.items.every((item) => item.image_url === null)).toBe(true);
    });
  });

  it('lists published bundles publicly without post-purchase instructions', async () => {
    const merchantId = '20000000-0000-4000-8000-000000000001';
    dataSourceQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('count(*)::integer AS total FROM bundles bundle')) {
        return [{ total: 1 }];
      }
      if (sql.includes('bundle_row.*')) {
        return [
          {
            id: BUNDLE_ID,
            merchant_id: merchantId,
            merchant_name: 'Akademi Teknik Budi',
            merchant_slug: 'akademi-teknik-budi',
            title: 'Paket AutoCAD',
            description: 'Paket hemat',
            cover_asset_id: null,
            cover_object_key: null,
            bundle_price: '349000',
            status: 'published',
            post_purchase_instructions: 'Rahasia pembeli',
            created_at: new Date('2026-09-30T00:00:00Z'),
          },
        ];
      }
      if (sql.includes('FROM bundle_items item')) {
        return [
          { bundle_id: BUNDLE_ID, ...catalog.autocad },
          { bundle_id: BUNDLE_ID, ...catalog.template },
        ];
      }
      return [];
    });

    const response = await service.findPublic({
      merchant_id: merchantId,
      page: 1,
      limit: 12,
    });

    expect(response.meta.total).toBe(1);
    expect(response.data[0]).toMatchObject({
      id: BUNDLE_ID,
      cover_url: null,
      merchant: { id: merchantId, name: 'Akademi Teknik Budi' },
    });
    expect(response.data[0]).not.toHaveProperty('post_purchase_instructions');
    expect(response.data[0]).not.toHaveProperty('status');
    const [countSql, countParams] = dataSourceQuery.mock.calls[0];
    expect(countSql).toContain("bundle.status = 'published'");
    expect(countParams).toEqual([merchantId]);
  });
});
