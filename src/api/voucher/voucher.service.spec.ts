import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Voucher } from './entities/voucher.entity';
import { VoucherService } from './voucher.service';

describe('VoucherService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const merchantId = '20000000-0000-4000-8000-000000000001';
  const voucherId = '40000000-0000-4000-8000-000000000001';
  let manager: Record<string, jest.Mock>;
  let dataSource: {
    transaction: jest.Mock;
    manager: Record<string, jest.Mock>;
    query: jest.Mock;
  };
  let service: VoucherService;

  const voucherRow = {
    id: voucherId,
    merchant_id: merchantId,
    name: 'Welcome voucher',
    code: 'WELCOME15',
    description: null,
    terms: null,
    discount_type: 'percentage',
    discount_value: '15',
    minimum_order_amount: null,
    maximum_discount_amount: null,
    max_uses: null,
    starts_at: null,
    expires_at: null,
    is_active: true,
    created_at: new Date('2026-09-18T00:00:00.000Z'),
    usage_count: '0',
  };

  const publicVoucherRow = {
    id: voucherId,
    name: 'Welcome voucher',
    code: 'WELCOME15',
    description: null,
    discount_type: 'percentage',
    discount_value: '15',
    minimum_order_amount: null,
    expires_at: null,
    merchant_id: merchantId,
    merchant_name: 'Akademi Teknik Raka',
    merchant_slug: 'akademi-teknik-raka',
    merchant_avatar_asset_id: null,
    merchant_tagline: null,
    merchant_category_label: 'Pemrograman & IT',
  };

  beforeEach(() => {
    manager = {
      create: jest.fn((target, value) =>
        target === Voucher ? { ...value, id: voucherId } : value,
      ),
      findOne: jest.fn().mockResolvedValue({ id: merchantId, userId }),
      query: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation(async (_target, value) => value),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
      manager,
      query: jest.fn().mockResolvedValue([voucherRow]),
    };
    service = new VoucherService(dataSource as unknown as DataSource);
  });

  it('creates a store-wide voucher with a normalized code and no product scope', async () => {
    await expect(
      service.create(userId, {
        name: 'Welcome voucher',
        code: ' welcome15 ',
        discount_type: 'percentage',
        discount_value: 15,
      }),
    ).resolves.toMatchObject({
      responseMessage: 'Create voucher success',
      data: { code: 'WELCOME15', discount_value: 15 },
    });

    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledWith(
      Voucher,
      expect.objectContaining({ merchantId, code: 'WELCOME15' }),
    );
  });

  it('rejects a create payload that still contains product_ids', async () => {
    await expect(
      service.create(userId, {
        name: 'Welcome voucher',
        code: 'WELCOME15',
        discount_type: 'percentage',
        discount_value: 15,
        product_ids: ['30000000-0000-4000-8000-000000000001'],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects an update payload that still contains product_ids', async () => {
    await expect(
      service.update(userId, voucherId, {
        product_ids: ['30000000-0000-4000-8000-000000000001'],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('searches public vouchers across voucher fields and the store name', async () => {
    dataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('WITH visible'))
        return Promise.resolve([publicVoucherRow]);
      return Promise.resolve([{ total: '1' }]);
    });

    await expect(service.findPublic({ search: 'raka' })).resolves.toMatchObject(
      {
        responseMessage: 'Get public vouchers success',
        data: [
          {
            id: voucherId,
            code: 'WELCOME15',
            discount_value: 15,
            merchant_category_slug: 'pemrograman-it',
          },
        ],
      },
    );

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('merchant.store_name ILIKE'),
      expect.any(Array),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.not.stringContaining('coupon_product_scopes'),
      expect.any(Array),
    );
  });

  it('returns a null category slug for a merchant without a canonical category', () => {
    const response = (
      service as unknown as {
        toPublicVoucherResponse: (row: typeof publicVoucherRow) => {
          merchant_category_slug: string | null;
        };
      }
    ).toPublicVoucherResponse({
      ...publicVoucherRow,
      merchant_category_label: null,
    });

    expect(response.merchant_category_slug).toBeNull();
  });

  it('filters public vouchers by the merchant category matching the slug', async () => {
    dataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('WITH visible'))
        return Promise.resolve([publicVoucherRow]);
      return Promise.resolve([{ total: '1' }]);
    });

    await service.findPublic({ category_slug: 'pemrograman-it' });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('profile.category_label = $3'),
      expect.arrayContaining(['Pemrograman & IT']),
    );
  });

  it('returns an empty page for a category slug outside the canonical list', async () => {
    await expect(
      service.findPublic({ category_slug: 'kuliner-jasa' }),
    ).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPage: 0 },
      responseMessage: 'Get public vouchers success',
    });

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('filters public vouchers by the merchant slug', async () => {
    dataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('WITH visible'))
        return Promise.resolve([publicVoucherRow]);
      return Promise.resolve([{ total: '1' }]);
    });

    await service.findPublic({ merchant_slug: 'akademi-teknik-raka' });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('profile.slug = $4'),
      expect.arrayContaining(['akademi-teknik-raka']),
    );
  });

  it.each([
    ['inactive', { is_active: false }],
    ['scheduled', { starts_at: new Date('2999-01-01T00:00:00.000Z') }],
    ['expired', { expires_at: new Date('2000-01-01T00:00:00.000Z') }],
    ['quota_reached', { max_uses: 1, usage_count: '1' }],
    ['active', {}],
  ])('derives the %s merchant status', (status, changes) => {
    const response = (
      service as unknown as {
        toVoucherResponse: (row: typeof voucherRow) => { status: string };
      }
    ).toVoucherResponse({ ...voucherRow, ...changes });

    expect(response.status).toBe(status);
  });

  it('rejects a percentage above 100 before entering a transaction', async () => {
    await expect(
      service.create(userId, {
        name: 'Invalid voucher',
        code: 'INVALID101',
        discount_type: 'percentage',
        discount_value: 101,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
