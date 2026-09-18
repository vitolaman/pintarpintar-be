import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Merchant } from '../merchant/entities/merchant.entity';
import { CouponProductScope } from './entities/coupon-product-scope.entity';
import { Voucher } from './entities/voucher.entity';
import { VoucherService } from './voucher.service';

describe('VoucherService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const merchantId = '20000000-0000-4000-8000-000000000001';
  const productId = '30000000-0000-4000-8000-000000000001';
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
    products: [
      {
        id: productId,
        title: 'AutoCAD Dasar',
        product_type: 'video_class',
        is_published: true,
      },
    ],
  };

  beforeEach(() => {
    manager = {
      create: jest.fn((target, value) =>
        target === Voucher ? { ...value, id: voucherId } : value,
      ),
      findOne: jest.fn().mockResolvedValue({ id: merchantId, userId }),
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: productId }]),
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

  it('creates a merchant-owned voucher with normalized code and scoped products', async () => {
    await expect(
      service.create(userId, {
        name: 'Welcome voucher',
        code: ' welcome15 ',
        discount_type: 'percentage',
        discount_value: 15,
        product_ids: [productId],
      }),
    ).resolves.toMatchObject({
      responseMessage: 'Create voucher success',
      data: { code: 'WELCOME15', discount_value: 15 },
    });

    expect(manager.save).toHaveBeenCalledWith(
      Voucher,
      expect.objectContaining({ merchantId, code: 'WELCOME15' }),
    );
    expect(manager.create).toHaveBeenCalledWith(CouponProductScope, {
      couponId: voucherId,
      productId,
    });
  });

  it('rejects a product outside the merchant before writing a voucher', async () => {
    manager.query
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(
      service.create(userId, {
        name: 'Welcome voucher',
        code: 'WELCOME15',
        discount_type: 'percentage',
        discount_value: 15,
        product_ids: [productId],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(manager.save).not.toHaveBeenCalled();
  });

  it('uses only active, currently valid, published-product vouchers publicly', async () => {
    dataSource.query.mockImplementation((sql: string) => {
      if (sql.includes('WITH visible')) return Promise.resolve([voucherRow]);
      return Promise.resolve([{ total: '1' }]);
    });

    await expect(service.findPublic({})).resolves.toMatchObject({
      responseMessage: 'Get public vouchers success',
      data: [{ id: voucherId, code: 'WELCOME15', discount_value: 15 }],
    });

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('coupon.is_active = true'),
      expect.any(Array),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining("product.publication_status = 'published'"),
      expect.any(Array),
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
        product_ids: [productId],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
