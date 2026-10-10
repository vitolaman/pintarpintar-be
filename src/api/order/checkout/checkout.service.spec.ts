import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '~/api/user/entities/user.entity';
import { VoucherService } from '~/api/voucher/voucher.service';
import { CheckoutQuote, CheckoutQuoteService } from './checkout-quote.service';
import { CheckoutService } from './checkout.service';

const userId = '10000000-0000-4000-8000-000000000001';
const classId = '20000000-0000-4000-8000-000000000001';
const pendingOrderId = '40000000-0000-4000-8000-000000000001';

const quoteResult = (override: Partial<CheckoutQuote> = {}): CheckoutQuote => ({
  pricing: {
    items: [
      {
        type: 'kelas',
        id: classId,
        title: 'AutoCAD',
        imageUrl: 'https://cdn.example.com/uploads/cover.png',
        merchantId: 'merchant-id',
        merchantName: 'Toko',
        price: 500000,
        discountAmount: 0,
      },
    ],
    codes: [],
    subtotal: 500000,
    discountTotal: 0,
    total: 500000,
  },
  references: [{ classId, productId: null, bundleId: null }],
  voucher: null,
  discountCode: null,
  rejectedCodes: [],
  ...override,
});

describe('CheckoutService', () => {
  let manager: Record<string, jest.Mock>;
  let quotes: { quote: jest.Mock };
  let vouchers: { checkoutVouchers: jest.Mock };
  let service: CheckoutService;

  beforeEach(() => {
    manager = {
      query: jest.fn(async () => []),
      findOneByOrFail: jest.fn(async () => ({ id: userId })),
    };
    quotes = { quote: jest.fn(async () => quoteResult()) };
    vouchers = {
      checkoutVouchers: jest.fn(async () => ({
        claimed: [{ id: 'claimed' }],
        recommended: [{ id: 'other' }],
      })),
    };
    service = new CheckoutService(
      {
        manager,
        transaction: jest.fn((callback) => callback(manager)),
      } as unknown as DataSource,
      quotes as unknown as CheckoutQuoteService,
      {} as never,
      {} as never,
      {} as never,
      vouchers as unknown as VoucherService,
    );
  });

  it('previews leniently and lists the rejected codes', async () => {
    const baseUrl = process.env.ASSET_PUBLIC_BASE_URL;
    process.env.ASSET_PUBLIC_BASE_URL = 'https://cdn.example.com';
    try {
      quotes.quote.mockResolvedValueOnce(
        quoteResult({ rejectedCodes: [{ code: 'TYPO', reason: 'not_found' }] }),
      );
      const request = { items: [{ id: classId }], codes: ['typo'] };

      const { data } = await service.preview(userId, request as never);

      expect(quotes.quote).toHaveBeenCalledWith(manager, userId, request, {
        lockCodes: false,
        lenient: true,
      });
      expect(data.rejected_codes).toEqual([
        { code: 'TYPO', reason: 'not_found' },
      ]);
      expect(data.items[0]).toMatchObject({
        image_url: 'https://cdn.example.com/uploads/cover.png',
      });
      expect(data.items[0]).not.toHaveProperty('image');
      expect(data.total_amount).toBe(500000);
      expect(vouchers.checkoutVouchers).toHaveBeenCalledWith(userId, [
        'merchant-id',
      ]);
      expect(data.claimed_vouchers).toEqual([{ id: 'claimed' }]);
      expect(data.recommended_vouchers).toEqual([{ id: 'other' }]);
    } finally {
      process.env.ASSET_PUBLIC_BASE_URL = baseUrl;
      if (baseUrl === undefined) delete process.env.ASSET_PUBLIC_BASE_URL;
    }
  });

  it('quotes checkout strictly and names the pending order of a conflict', async () => {
    manager.query.mockImplementation(async (sql: string) =>
      sql.includes('FROM orders purchase')
        ? [{ id: pendingOrderId, item_id: classId }]
        : [],
    );

    const attempt = service.checkout(userId, {
      items: [{ id: classId }],
    } as never);

    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    const error: ConflictException = await attempt.catch((caught) => caught);
    expect(error.getResponse()).toMatchObject({
      message: `Item ${classId} is awaiting payment in order ${pendingOrderId}`,
      details: { order_id: pendingOrderId },
    });
    expect(manager.findOneByOrFail).toHaveBeenCalledWith(User, { id: userId });
    expect(quotes.quote).toHaveBeenCalledWith(
      manager,
      userId,
      expect.anything(),
      { lockCodes: true },
    );
  });
});
