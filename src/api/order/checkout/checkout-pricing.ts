import { BadRequestException } from '@nestjs/common';
import { CatalogItemType } from '~/common/catalog/catalog-item';

export type CodeDiscountType = 'percentage' | 'nominal';

export interface PricingItem {
  type: CatalogItemType;
  id: string;
  title: string;
  image: string | null;
  merchantId: string;
  merchantName: string | null;
  // Current selling price in whole rupiah.
  price: number;
}

interface CodeRule {
  id: string;
  code: string;
  merchantId: string;
  merchantName: string | null;
  discountType: CodeDiscountType;
  value: number;
  minimumPurchase: number | null;
}

export interface VoucherRule extends CodeRule {
  kind: 'voucher';
  maximumDiscount: number | null;
}

export interface DiscountCodeRule extends CodeRule {
  kind: 'discount';
  // Null when the discount targets every item of its merchant.
  targets: { classIds: Set<string>; productIds: Set<string> } | null;
}

export type PromoCodeRule = VoucherRule | DiscountCodeRule;

export interface PricedItem extends PricingItem {
  discountAmount: number;
}

export interface AppliedCode {
  kind: PromoCodeRule['kind'];
  id: string;
  code: string;
  merchantId: string;
  merchantName: string | null;
  discountAmount: number;
}

export interface PricingResult {
  items: PricedItem[];
  codes: AppliedCode[];
  subtotal: number;
  discountTotal: number;
  total: number;
}

/**
 * Prices a checkout selection. Each code applies only to its own merchant's
 * eligible items: the discount code first, then the voucher on what remains.
 * Minimums use the eligible subtotal before any code. Amounts are whole
 * rupiah, rounded down, and each code's discount is spread over its items
 * so that the shares sum exactly to it.
 */
export function priceSelection(
  items: PricingItem[],
  rules: PromoCodeRule[],
): PricingResult {
  for (const item of items) {
    if (!Number.isInteger(item.price) || item.price < 0) {
      throw new BadRequestException(
        `Item ${item.id} does not have a whole-rupiah price`,
      );
    }
  }

  const remaining = items.map((item) => item.price);
  const discounts = items.map(() => 0);
  const ordered = [
    ...rules.filter((rule) => rule.kind === 'discount'),
    ...rules.filter((rule) => rule.kind === 'voucher'),
  ];

  const codes = ordered.map((rule): AppliedCode => {
    const eligible = items
      .map((item, index) => (isEligible(item, rule) ? index : -1))
      .filter((index) => index >= 0);
    if (eligible.length === 0) {
      throw new BadRequestException(
        `Code ${rule.code} does not apply to any selected item`,
      );
    }

    const eligibleSubtotal = sum(eligible.map((index) => items[index].price));
    if (
      rule.minimumPurchase !== null &&
      eligibleSubtotal < rule.minimumPurchase
    ) {
      throw new BadRequestException(
        `Code ${rule.code} requires a minimum purchase of Rp${rule.minimumPurchase} from ${rule.merchantName ?? 'its merchant'}`,
      );
    }

    const base = sum(eligible.map((index) => remaining[index]));
    const amount = codeDiscount(rule, base);
    const shares = spread(
      amount,
      eligible.map((index) => remaining[index]),
    );
    eligible.forEach((index, position) => {
      remaining[index] -= shares[position];
      discounts[index] += shares[position];
    });

    return {
      kind: rule.kind,
      id: rule.id,
      code: rule.code,
      merchantId: rule.merchantId,
      merchantName: rule.merchantName,
      discountAmount: amount,
    };
  });

  const subtotal = sum(items.map((item) => item.price));
  const discountTotal = sum(discounts);
  return {
    items: items.map((item, index) => ({
      ...item,
      discountAmount: discounts[index],
    })),
    codes,
    subtotal,
    discountTotal,
    total: subtotal - discountTotal,
  };
}

function isEligible(item: PricingItem, rule: PromoCodeRule): boolean {
  if (item.merchantId !== rule.merchantId) return false;
  if (rule.kind === 'voucher' || rule.targets === null) return true;

  switch (item.type) {
    case 'kelas':
    case 'bootcamp':
      return rule.targets.classIds.has(item.id);
    case 'digital':
      return rule.targets.productIds.has(item.id);
    default:
      return false;
  }
}

function codeDiscount(rule: PromoCodeRule, base: number): number {
  // Percentages may have decimals; hundredths of a percent keep the
  // arithmetic in integers.
  const amount =
    rule.discountType === 'percentage'
      ? Math.floor((base * Math.round(rule.value * 100)) / 10_000)
      : Math.min(Math.floor(rule.value), base);
  const capped =
    rule.kind === 'voucher' && rule.maximumDiscount !== null
      ? Math.min(amount, Math.floor(rule.maximumDiscount))
      : amount;
  return Math.max(capped, 0);
}

// Splits `amount` over `weights` proportionally, rounding down, and gives the
// leftover rupiah to the largest fractional parts (earlier items first on
// ties). `amount` never exceeds the weights' sum, so no share exceeds its
// weight.
export function spread(amount: number, weights: number[]): number[] {
  const total = sum(weights);
  if (amount === 0 || total === 0) return weights.map(() => 0);

  const exact = weights.map((weight) => (amount * weight) / total);
  const shares = exact.map((value) => Math.floor(value));
  let leftover = amount - sum(shares);
  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of byFraction) {
    if (leftover === 0) break;
    shares[index] += 1;
    leftover -= 1;
  }
  return shares;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
