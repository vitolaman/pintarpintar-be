import { MerchantStorageLevel } from '~/api/merchant/entities/merchant.entity';
import type { InactivityAction } from './entities/merchant-level-evaluation.entity';

const GIBIBYTE = 1024 * 1024 * 1024;

// Monthly revenue (merchant net of paid sales, IDR) at which a level starts.
export const SILVER_MONTHLY_REVENUE = 2_500_000;
export const GOLD_MONTHLY_REVENUE = 5_000_000;

type LevelRule = {
  label: string;
  // Per-file limit for merchant content uploads while no Pro subscription
  // exists; Pro (not built yet) is meant to lift it.
  maxUploadBytes: number;
  // Shown only: storage enforcement awaits the PM's decision.
  storageQuotaBytes: number;
};

export const MERCHANT_LEVEL_RULES: Record<MerchantStorageLevel, LevelRule> = {
  [MerchantStorageLevel.BASIC]: {
    label: 'Basic',
    maxUploadBytes: 1 * GIBIBYTE,
    storageQuotaBytes: 30 * GIBIBYTE,
  },
  [MerchantStorageLevel.SILVER]: {
    label: 'Silver',
    maxUploadBytes: 5 * GIBIBYTE,
    storageQuotaBytes: 100 * GIBIBYTE,
  },
  [MerchantStorageLevel.GOLD]: {
    label: 'Gold',
    maxUploadBytes: 10 * GIBIBYTE,
    storageQuotaBytes: 200 * GIBIBYTE,
  },
};

export const LARGEST_UPLOAD_BYTES = Math.max(
  ...Object.values(MERCHANT_LEVEL_RULES).map((rule) => rule.maxUploadBytes),
);

export function levelForRevenue(revenue: number): MerchantStorageLevel {
  if (revenue >= GOLD_MONTHLY_REVENUE) return MerchantStorageLevel.GOLD;
  if (revenue >= SILVER_MONTHLY_REVENUE) return MerchantStorageLevel.SILVER;
  return MerchantStorageLevel.BASIC;
}

/**
 * The level after evaluating one month: any merchant moves straight to the
 * level the month reaches, except that Silver drops to Basic only after two
 * consecutive months under the Silver threshold.
 */
export function nextLevel(
  current: MerchantStorageLevel,
  revenue: number,
  previousMonthRevenue: number,
): MerchantStorageLevel {
  const reached = levelForRevenue(revenue);
  if (
    current === MerchantStorageLevel.SILVER &&
    reached === MerchantStorageLevel.BASIC &&
    previousMonthRevenue >= SILVER_MONTHLY_REVENUE
  ) {
    return MerchantStorageLevel.SILVER;
  }
  return reached;
}

export type InactivityFacts = {
  hasItems: boolean;
  monthHasSale: boolean;
  previousMonthHasSale: boolean;
  // A counted month is a full month after tracking started or after the last
  // removal; earlier months never lead to a warning.
  monthCounted: boolean;
  previousMonthCounted: boolean;
  previousAction: InactivityAction | null;
};

/**
 * Two counted months without a paid sale give a warning; a further month
 * without a sale after that warning removes the merchant's items. A removal
 * always needs a warning first.
 */
export function inactivityAction(facts: InactivityFacts): InactivityAction {
  if (!facts.hasItems || facts.monthHasSale) return 'none';
  if (facts.previousAction === 'warning') return 'removed';
  if (
    facts.monthCounted &&
    facts.previousMonthCounted &&
    !facts.previousMonthHasSale
  ) {
    return 'warning';
  }
  return 'none';
}
