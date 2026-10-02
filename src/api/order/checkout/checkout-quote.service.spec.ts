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
            is_usable: true,
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
