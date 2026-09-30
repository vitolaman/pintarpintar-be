import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { Merchant } from '../merchant/entities/merchant.entity';
import { BundleService } from './bundle.service';
import { CreateBundleDto } from './dto/bundle-request.dto';
import { BundleItem } from './entities/bundle-item.entity';
import { Bundle } from './entities/bundle.entity';

const CLASS_ID = '10000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000002';
const BUNDLE_ID = '10000000-0000-4000-8000-000000000003';

const catalog = {
  autocad: {
    id: CLASS_ID,
    type: 'kelas',
    class_type: 'video',
    title: 'Belajar AutoCAD dari Nol',
    price: '299000',
    image: null,
    is_available: true,
  },
  template: {
    id: PRODUCT_ID,
    type: 'digital',
    class_type: null,
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
    bundle_price: 349000,
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
    [{ bundle_price: 0 }],
    [{ title: '' }],
    [{ status: 'active' }],
  ])('rejects %j', async (override) => {
    expect(await errorsFor(override)).not.toHaveLength(0);
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
      bundle_price: 349000,
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
      original_total: 424000,
      bundle_price: 349000,
      saving_amount: 75000,
      saving_percent: 18,
      sales_count: 2,
      status: 'published',
    });
    expect(data.items.map((item) => item.type)).toEqual(['kelas', 'digital']);
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

  it('rejects publishing with an unavailable item but allows unpublished', async () => {
    manager.query.mockResolvedValue([
      { ...catalog.autocad, is_available: false },
      catalog.template,
    ]);

    await expect(service.create('user-id', input())).rejects.toThrow(
      /must be published/,
    );
    await expect(
      service.create('user-id', input({ status: 'unpublished' })),
    ).resolves.toBeDefined();
  });

  it.each([[424000], [500000]])(
    'rejects a bundle price of %i (not below the total)',
    async (bundlePrice) => {
      await expect(
        service.create('user-id', input({ bundle_price: bundlePrice })),
      ).rejects.toThrow(/lower than the items total \(424000\)/);
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
      service.update('user-id', BUNDLE_ID, { bundle_price: 430000 }),
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
});
