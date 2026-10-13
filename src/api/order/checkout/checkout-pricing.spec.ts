import { BadRequestException } from '@nestjs/common';
import {
  CodeRejectedException,
  DiscountCodeRule,
  PricingItem,
  VoucherRule,
  assertCodeApplies,
  priceSelection,
  spread,
} from './checkout-pricing';

const item = (
  id: string,
  merchantId: string,
  price: number,
  type: PricingItem['type'] = 'kelas',
  platformFeePaidBy: PricingItem['platformFeePaidBy'] = 'merchant',
): PricingItem => ({
  type,
  id,
  title: `Item ${id}`,
  imageUrl: null,
  merchantId,
  merchantName: `Merchant ${merchantId}`,
  price,
  platformFeePaidBy,
});

const voucher = (override: Partial<VoucherRule> = {}): VoucherRule => ({
  kind: 'voucher',
  id: 'voucher-id',
  code: 'HEMAT10',
  merchantId: 'A',
  merchantName: 'Merchant A',
  discountType: 'percentage',
  value: 10,
  minimumPurchase: null,
  maximumDiscount: null,
  ...override,
});

const discountCode = (
  override: Partial<DiscountCodeRule> = {},
): DiscountCodeRule => ({
  kind: 'discount',
  id: 'discount-code-id',
  code: 'DSC-ABCD2345',
  merchantId: 'A',
  merchantName: 'Merchant A',
  discountType: 'nominal',
  value: 50000,
  minimumPurchase: null,
  targets: null,
  ...override,
});

describe('priceSelection platform fee', () => {
  it('charges 2.5% after codes and adds it to the total when the buyer pays', () => {
    const result = priceSelection(
      [item('a1', 'A', 200000, 'kelas', 'buyer')],
      [voucher({ discountType: 'nominal', value: 20000 })],
    );

    expect(result.items[0]).toMatchObject({
      discountAmount: 20000,
      platformFee: 4500,
      platformFeePaidBy: 'buyer',
    });
    expect(result).toMatchObject({
      subtotal: 200000,
      discountTotal: 20000,
      platformFeeTotal: 4500,
      total: 184500,
    });
  });

  it('keeps the fee out of the total when the merchant absorbs it', () => {
    const result = priceSelection(
      [item('a1', 'A', 200000)],
      [voucher({ discountType: 'nominal', value: 20000 })],
    );

    expect(result.items[0].platformFee).toBe(4500);
    expect(result).toMatchObject({ platformFeeTotal: 0, total: 180000 });
  });

  it('adds only the fees of merchants that pass it on', () => {
    const result = priceSelection(
      [
        item('a1', 'A', 100000, 'kelas', 'buyer'),
        item('b1', 'B', 50000, 'digital', 'merchant'),
      ],
      [],
    );

    expect(result.items.map((priced) => priced.platformFee)).toEqual([
      2500, 1250,
    ]);
    expect(result).toMatchObject({ platformFeeTotal: 2500, total: 152500 });
  });

  it.each([
    [99999, 2500],
    [9990, 250],
    [9800, 245],
    [20, 1],
    [19, 0],
    [0, 0],
  ])('rounds the fee of %d to the nearest rupiah (%d)', (price, expected) => {
    const result = priceSelection(
      [item('a1', 'A', price, 'bundle', 'buyer')],
      [],
    );
    expect(result.items[0].platformFee).toBe(expected);
    expect(result.total).toBe(price + expected);
  });

  it('charges no fee on an item discounted to zero', () => {
    const result = priceSelection(
      [item('a1', 'A', 50000, 'kelas', 'buyer')],
      [voucher({ discountType: 'percentage', value: 100 })],
    );

    expect(result.items[0].platformFee).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe('priceSelection', () => {
  it('sums the selling prices without codes', () => {
    const result = priceSelection(
      [item('a1', 'A', 150000), item('b1', 'B', 200000)],
      [],
    );

    expect(result).toMatchObject({
      subtotal: 350000,
      discountTotal: 0,
      total: 350000,
      codes: [],
    });
  });

  it('applies a capped voucher only to its merchant items', () => {
    const result = priceSelection(
      [
        item('a1', 'A', 100000),
        item('a2', 'A', 200000),
        item('b1', 'B', 200000),
      ],
      [voucher({ maximumDiscount: 20000 })],
    );

    expect(result.codes).toEqual([
      expect.objectContaining({ code: 'HEMAT10', discountAmount: 20000 }),
    ]);
    expect(result.total).toBe(480000);
    expect(result.items.map((line) => line.discountAmount)).toEqual([
      6667, 13333, 0,
    ]);
  });

  it('rounds a percentage down to whole rupiah', () => {
    const result = priceSelection(
      [item('a1', 'A', 99999)],
      [voucher({ value: 12.5 })],
    );

    expect(result.discountTotal).toBe(12499);
    expect(result.total).toBe(87500);
  });

  it('limits a nominal discount to the eligible amount', () => {
    const result = priceSelection(
      [item('a1', 'A', 30000)],
      [discountCode({ value: 50000 })],
    );

    expect(result.total).toBe(0);
    expect(result.items[0].discountAmount).toBe(30000);
  });

  it('applies a targeted discount code only to its target items', () => {
    const result = priceSelection(
      [
        item('a1', 'A', 100000),
        item('p1', 'A', 80000, 'digital'),
        item('bundle1', 'A', 300000, 'bundle'),
      ],
      [
        discountCode({
          discountType: 'percentage',
          value: 50,
          targets: { classIds: new Set(), productIds: new Set(['p1']) },
        }),
      ],
    );

    expect(result.items.map((line) => line.discountAmount)).toEqual([
      0, 40000, 0,
    ]);
  });

  it('includes bundles in an untargeted discount code', () => {
    const result = priceSelection(
      [item('bundle1', 'A', 300000, 'bundle')],
      [discountCode({ value: 10000 })],
    );

    expect(result.total).toBe(290000);
  });

  it('applies the discount code first and the voucher to the remainder', () => {
    const result = priceSelection(
      [item('a1', 'A', 200000)],
      [voucher({ value: 10 }), discountCode({ value: 50000 })],
    );

    expect(
      result.codes.map((code) => [code.kind, code.discountAmount]),
    ).toEqual([
      ['discount', 50000],
      ['voucher', 15000],
    ]);
    expect(result.total).toBe(135000);
  });

  it('checks minimums against the eligible subtotal before codes', () => {
    const items = [item('a1', 'A', 100000), item('b1', 'B', 400000)];

    expect(() =>
      priceSelection(items, [voucher({ minimumPurchase: 150000 })]),
    ).toThrow(
      new BadRequestException(
        'Code HEMAT10 requires a minimum purchase of Rp150000 from Merchant A',
      ),
    );
    expect(
      priceSelection(items, [
        discountCode({ value: 90000 }),
        voucher({ minimumPurchase: 100000 }),
      ]).total,
    ).toBe(409000);
  });

  it('rejects a code that matches no selected item', () => {
    expect(() =>
      priceSelection([item('b1', 'B', 100000)], [voucher()]),
    ).toThrow('Code HEMAT10 does not apply to any selected item');
    expect(() =>
      priceSelection(
        [item('a1', 'A', 100000)],
        [
          discountCode({
            targets: { classIds: new Set(['other']), productIds: new Set() },
          }),
        ],
      ),
    ).toThrow('does not apply to any selected item');
  });

  it.each([
    [
      'another merchant',
      [item('b1', 'B', 100000)],
      voucher(),
      'not_applicable',
    ],
    [
      'a minimum above the eligible subtotal',
      [item('a1', 'A', 100000), item('b1', 'B', 400000)],
      voucher({ minimumPurchase: 150000 }),
      'minimum_not_met',
    ],
  ])(
    'reports a code rejected for %s with its reason',
    (_case, items, rule, reason) => {
      let rejection: unknown;
      try {
        assertCodeApplies(items, rule);
      } catch (error) {
        rejection = error;
      }
      expect(rejection).toBeInstanceOf(CodeRejectedException);
      expect(rejection).toBeInstanceOf(BadRequestException);
      expect(rejection).toMatchObject({ promoCode: 'HEMAT10', reason });
    },
  );

  it('accepts a code with an eligible item and its minimum met', () => {
    expect(() =>
      assertCodeApplies(
        [item('a1', 'A', 200000)],
        voucher({ minimumPurchase: 150000 }),
      ),
    ).not.toThrow();
  });

  it('rejects a price that is not whole rupiah', () => {
    expect(() => priceSelection([item('a1', 'A', 1000.5)], [])).toThrow(
      'does not have a whole-rupiah price',
    );
  });

  it('never lowers an item below zero and keeps shares exact', () => {
    const items = [
      item('a1', 'A', 33333),
      item('a2', 'A', 33333),
      item('a3', 'A', 33334),
    ];
    const result = priceSelection(items, [
      discountCode({ value: 99999 }),
      voucher({ value: 100 }),
    ]);

    expect(result.total).toBe(0);
    expect(result.discountTotal).toBe(100000);
    result.items.forEach((line) =>
      expect(line.discountAmount).toBeLessThanOrEqual(line.price),
    );
  });
});

describe('spread', () => {
  it('splits proportionally and gives leftovers to the largest fractions', () => {
    expect(spread(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(spread(20000, [100000, 200000])).toEqual([6667, 13333]);
  });

  it('returns zero shares for a zero amount or zero weights', () => {
    expect(spread(0, [5, 5])).toEqual([0, 0]);
    expect(spread(5, [0, 0])).toEqual([0, 0]);
  });

  it('always sums to the amount', () => {
    for (let amount = 0; amount <= 1000; amount += 37) {
      const weights = [1234, 5678, 91011, 1];
      expect(spread(amount, weights).reduce((a, b) => a + b, 0)).toBe(amount);
    }
  });
});
