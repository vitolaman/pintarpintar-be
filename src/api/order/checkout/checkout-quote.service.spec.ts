import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CheckoutQuoteService } from './checkout-quote.service';

const userId = '10000000-0000-4000-8000-000000000001';

describe('CheckoutQuoteService discount codes', () => {
  let usedByUser: boolean;
  let codeType: 'once' | 'recurring';
  let query: jest.Mock;
  let loadCodes: (codes: string[]) => Promise<unknown[]>;

  beforeEach(() => {
    usedByUser = false;
    codeType = 'recurring';
    query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM coupons')) return [];
      if (sql.includes('FROM discount_codes')) {
        return [
          {
            id: 'code-id',
            code: 'HEMAT',
            usage_limit: 100,
            used_count: 3,
            code_type: codeType,
            discount_id: 'discount-id',
            merchant_id: 'merchant-id',
            merchant_name: 'Toko',
            discount_type: 'percentage',
            discount_value: '10',
            minimum_purchase: null,
            is_active: true,
            not_started: false,
            has_ended: false,
          },
        ];
      }
      if (sql.includes('FROM orders'))
        return usedByUser ? [{ '?column?': 1 }] : [];
      if (sql.includes('FROM discount_products')) return [];
      return [];
    });
    const service = new CheckoutQuoteService();
    const manager = { query } as unknown as EntityManager;
    loadCodes = (codes) =>
      (
        service as unknown as {
          loadCodes: (
            manager: EntityManager,
            userId: string,
            codes: string[],
            lock: boolean,
          ) => Promise<unknown[]>;
        }
      ).loadCodes(manager, userId, codes, true);
  });

  it('accepts a recurring code the user has not used', async () => {
    await expect(loadCodes(['hemat'])).resolves.toHaveLength(1);
    const ordersCheck = query.mock.calls.find(([sql]) =>
      sql.includes('FROM orders'),
    );
    expect(ordersCheck[0]).toContain("status = 'paid'");
    expect(ordersCheck[0]).toContain('expires_at > now()');
    expect(ordersCheck[1]).toEqual(['code-id', userId]);
  });

  it('rejects a recurring code the user already used', async () => {
    usedByUser = true;
    await expect(loadCodes(['hemat'])).rejects.toThrow(
      'You have already used code HEMAT',
    );
    await expect(loadCodes(['hemat'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not limit single-use codes per user', async () => {
    codeType = 'once';
    usedByUser = true;
    await expect(loadCodes(['hemat'])).resolves.toHaveLength(1);
    expect(query.mock.calls.some(([sql]) => sql.includes('FROM orders'))).toBe(
      false,
    );
  });
});

describe('CheckoutQuoteService items', () => {
  const classId = '20000000-0000-4000-8000-000000000001';
  const productId = '20000000-0000-4000-8000-000000000002';
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('AS family')) {
      return [
        { id: classId, family: 'class' },
        { id: productId, family: 'product' },
      ];
    }
    if (sql.includes('FROM enrollments enrollment')) return [];
    if (sql.includes('FROM (')) {
      return [
        {
          type: 'bootcamp',
          id: classId,
          title: 'Bootcamp BIM',
          image: null,
          price: '500000',
          original_price: '500000',
          merchant_id: 'merchant-id',
          merchant_name: 'Toko',
          merchant_slug: 'toko',
          is_available: true,
          merchant_active: true,
        },
        {
          type: 'digital',
          id: productId,
          title: 'Template RAB',
          image: null,
          price: '100000',
          original_price: '100000',
          merchant_id: 'merchant-id',
          merchant_name: 'Toko',
          merchant_slug: 'toko',
          is_available: true,
          merchant_active: true,
        },
      ];
    }
    return [];
  });
  const manager = { query } as unknown as EntityManager;
  const quote = (items: object[]) =>
    new CheckoutQuoteService().quote(manager, userId, { items } as never, {
      lockCodes: false,
    });

  it('prices items sent by id alone, with their resolved kinds', async () => {
    const result = await quote([{ id: classId }, { id: productId }]);
    expect(result.references).toEqual([
      { classId, productId: null, bundleId: null },
      { classId: null, productId, bundleId: null },
    ]);
    expect(result.pricing.subtotal).toBe(600000);
  });

  it('accepts kelas for a bootcamp and rejects another family by id', async () => {
    await expect(
      quote([{ type: 'kelas', id: classId }]),
    ).resolves.toBeDefined();
    await expect(quote([{ type: 'bundle', id: productId }])).rejects.toThrow(
      `Item ${productId} is a digital product, not bundle`,
    );
  });
});

describe('CheckoutQuoteService code rejections', () => {
  const classId = '30000000-0000-4000-8000-000000000001';
  const productId = '30000000-0000-4000-8000-000000000002';
  let vouchers: Record<string, object>;
  let discountCodes: Record<string, object>;
  let targets: object[];
  let usedByUser: boolean;

  const catalogRow = (id: string, type: string, price: string) => ({
    type,
    id,
    title: `Item ${id}`,
    image: null,
    price,
    original_price: price,
    merchant_id: 'merchant-id',
    merchant_name: 'Toko',
    merchant_slug: 'toko',
    is_available: true,
    merchant_active: true,
  });
  const voucherRow = (code: string, override: object = {}) => ({
    id: `voucher-${code}`,
    code,
    merchant_id: 'merchant-id',
    merchant_name: 'Toko',
    discount_type: 'percentage',
    discount_value: '10',
    minimum_order_amount: null,
    maximum_discount_amount: null,
    max_uses: null,
    used: 0,
    is_active: true,
    not_started: false,
    has_ended: false,
    ...override,
  });
  const discountRow = (code: string, override: object = {}) => ({
    id: `code-${code}`,
    code,
    usage_limit: 10,
    used_count: 0,
    code_type: 'once',
    discount_id: 'discount-id',
    merchant_id: 'merchant-id',
    merchant_name: 'Toko',
    discount_type: 'nominal',
    discount_value: '50000',
    minimum_purchase: null,
    is_active: true,
    not_started: false,
    has_ended: false,
    ...override,
  });

  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('AS family')) {
      return [
        { id: classId, family: 'class' },
        { id: productId, family: 'product' },
      ];
    }
    if (sql.includes('FROM enrollments enrollment')) return [];
    if (sql.includes('FROM coupons coupon')) {
      const row = vouchers[params[0] as string];
      return row ? [row] : [];
    }
    if (sql.includes('FROM discount_codes code')) {
      const row = discountCodes[params[0] as string];
      return row ? [row] : [];
    }
    if (sql.includes('FROM orders')) return usedByUser ? [{ found: 1 }] : [];
    if (sql.includes('FROM discount_products')) return targets;
    if (sql.includes('FROM (')) {
      return [
        catalogRow(classId, 'kelas', '500000'),
        catalogRow(productId, 'digital', '100000'),
      ];
    }
    return [];
  });
  const manager = { query } as unknown as EntityManager;
  const quote = (codes: string[], lenient = true) =>
    new CheckoutQuoteService().quote(
      manager,
      userId,
      { items: [{ id: classId }, { id: productId }], codes } as never,
      { lockCodes: false, lenient },
    );

  beforeEach(() => {
    vouchers = { HEMAT10: voucherRow('HEMAT10') };
    discountCodes = { DSC50: discountRow('DSC50') };
    targets = [];
    usedByUser = false;
  });

  it('applies a valid voucher and rejects a mistyped discount code', async () => {
    const result = await quote(['hemat10', ' typo ']);

    expect(result.rejectedCodes).toEqual([
      { code: 'TYPO', reason: 'not_found' },
    ]);
    expect(result.pricing.codes.map((code) => code.code)).toEqual(['HEMAT10']);
    expect(result.pricing.total).toBe(540000);
    expect(result.voucher?.code).toBe('HEMAT10');
    expect(result.discountCode).toBeNull();
  });

  it.each([
    ['an ended voucher', 'HEMAT10', { has_ended: true }, 'expired'],
    ['a deactivated voucher', 'HEMAT10', { is_active: false }, 'expired'],
    [
      'a voucher that starts later',
      'HEMAT10',
      { not_started: true },
      'not_started',
    ],
    ['a used-up voucher', 'HEMAT10', { max_uses: 5, used: 5 }, 'used_up'],
    ['a used-up discount code', 'DSC50', { used_count: 10 }, 'used_up'],
    ['an ended discount', 'DSC50', { has_ended: true }, 'expired'],
    [
      'a voucher below its minimum',
      'HEMAT10',
      { minimum_order_amount: '1000000' },
      'minimum_not_met',
    ],
    [
      "another merchant's voucher",
      'HEMAT10',
      { merchant_id: 'other-merchant' },
      'not_applicable',
    ],
  ])('rejects %s as %s in preview', async (_case, code, override, reason) => {
    if (code === 'HEMAT10') vouchers.HEMAT10 = voucherRow(code, override);
    else discountCodes.DSC50 = discountRow(code, override);

    const result = await quote([code]);

    expect(result.rejectedCodes).toEqual([{ code, reason }]);
    expect(result.pricing.codes).toEqual([]);
    expect(result.pricing.total).toBe(600000);
  });

  it('rejects a recurring code the user already used as already_used', async () => {
    discountCodes.DSC50 = discountRow('DSC50', { code_type: 'recurring' });
    usedByUser = true;

    const result = await quote(['DSC50', 'HEMAT10']);

    expect(result.rejectedCodes).toEqual([
      { code: 'DSC50', reason: 'already_used' },
    ]);
    expect(result.pricing.codes.map((code) => code.code)).toEqual(['HEMAT10']);
  });

  it('rejects a discount code that targets no selected item as not_applicable', async () => {
    targets = [{ class_id: 'another-class', product_id: null }];

    const result = await quote(['DSC50']);

    expect(result.rejectedCodes).toEqual([
      { code: 'DSC50', reason: 'not_applicable' },
    ]);
  });

  it('keeps errors of the request itself in preview', async () => {
    vouchers.HEMAT20 = voucherRow('HEMAT20');

    await expect(quote(['HEMAT10', 'hemat10'])).rejects.toThrow(
      'A code is entered more than once',
    );
    await expect(quote(['HEMAT10', 'HEMAT20'])).rejects.toThrow(
      'Only one voucher and one discount code can be used',
    );
  });

  it('prices the usable voucher when another voucher is rejected', async () => {
    vouchers.LAMA = voucherRow('LAMA', { has_ended: true });

    const result = await quote(['HEMAT10', 'LAMA']);

    expect(result.rejectedCodes).toEqual([{ code: 'LAMA', reason: 'expired' }]);
    expect(result.voucher?.code).toBe('HEMAT10');
  });

  it.each([
    [['TYPO'], {}, 'Code TYPO is invalid or expired'],
    [['HEMAT10'], { has_ended: true }, 'Code HEMAT10 is invalid or expired'],
    [
      ['HEMAT10'],
      { max_uses: 1, used: 1 },
      'Code HEMAT10 has reached its usage limit',
    ],
    [
      ['HEMAT10'],
      { minimum_order_amount: '1000000' },
      'Code HEMAT10 requires a minimum purchase of Rp1000000 from Toko',
    ],
  ])('stays strict for checkout: %j', async (codes, override, message) => {
    vouchers.HEMAT10 = voucherRow('HEMAT10', override);

    const attempt = quote(codes, false);

    await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
    await expect(attempt).rejects.toThrow(message);
  });

  it('returns no rejected codes when strict', async () => {
    const result = await quote(['HEMAT10'], false);
    expect(result.rejectedCodes).toEqual([]);
  });
});
