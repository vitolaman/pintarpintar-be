// The platform fee (team decision, 2026-10-13): 2.5% of each item's final
// price, after its voucher and discount-code share, for every merchant and
// item type. Each merchant chooses who pays it.
export const PLATFORM_FEE_BASIS_POINTS = 250;

export const platformFeePayers = ['merchant', 'buyer'] as const;
export type PlatformFeePayer = (typeof platformFeePayers)[number];

// The merchant absorbs the fee unless it opts to pass it on (owner,
// 2026-10-13), so buyers pay the same until a merchant changes the setting.
export const DEFAULT_PLATFORM_FEE_PAYER: PlatformFeePayer = 'merchant';

/**
 * The fee of one item in whole rupiah: the final price times the rate,
 * rounded to the nearest rupiah with halves up, in integer arithmetic.
 */
export function platformFee(finalPrice: number): number {
  return Math.floor((finalPrice * PLATFORM_FEE_BASIS_POINTS + 5_000) / 10_000);
}

/**
 * The merchant's net from an order item (`alias` is the `order_items`
 * alias): its price minus its code discount share, minus its platform fee
 * when the merchant absorbs it. Items from before the fee have no payer and
 * a fee of 0.
 */
export const merchantItemNetSql = (alias: string) =>
  `(${alias}.price_at_purchase - ${alias}.discount_amount
    - CASE WHEN ${alias}.platform_fee_paid_by = 'merchant' THEN ${alias}.platform_fee_amount ELSE 0 END)`;
