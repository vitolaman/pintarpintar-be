import { EntityManager, MoreThan } from 'typeorm';
import { MerchantProPeriod } from './entities/merchant-pro-period.entity';

export interface ProStatus {
  isPro: boolean;
  /** End of the Pro time that continues from now without a gap. */
  proUntil: Date | null;
  /** After the Pro time ends its benefits continue until `graceUntil`. */
  inGrace: boolean;
  graceUntil: Date | null;
}

// Pro benefits continue after the Pro time ends until 00.00 WIB of the
// seventh Asia/Jakarta date after the end, the date the merchant is told
// Pro ends (owner decision 2026-10-10).
export const PRO_GRACE_DAYS = 7;
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function proGraceEnd(proEnd: Date): Date {
  const jakarta = new Date(proEnd.getTime() + JAKARTA_OFFSET_MS);
  const midnight = Date.UTC(
    jakarta.getUTCFullYear(),
    jakarta.getUTCMonth(),
    jakarta.getUTCDate() + PRO_GRACE_DAYS,
  );
  return new Date(midnight - JAKARTA_OFFSET_MS);
}

/** Whether the store has the Pro benefits now: Pro, or within the grace. */
export function hasProBenefits(status: ProStatus): boolean {
  return status.isPro || status.inGrace;
}

export interface ProPeriodGroups extends ProStatus {
  current: MerchantProPeriod | null;
  upcoming: MerchantProPeriod[];
  history: MerchantProPeriod[];
}

const byStart = (a: MerchantProPeriod, b: MerchantProPeriod) =>
  a.startsAt.getTime() - b.startsAt.getTime();

/**
 * Pro status from a merchant's periods: Pro while an active period covers
 * `now`. Periods that start at or before the running end extend it, so
 * back-to-back periods read as one stretch. Overlapping rows (only possible
 * through a manual grant) still give one answer.
 */
export function groupProPeriods(
  periods: MerchantProPeriod[],
  now: Date,
): ProPeriodGroups {
  const time = now.getTime();
  const active = periods.filter((period) => period.status === 'active');
  const covering = active
    .filter(
      (period) =>
        period.startsAt.getTime() <= time && period.endsAt.getTime() > time,
    )
    .sort(byStart);
  const current = covering[0] ?? null;

  let proUntil: Date | null = null;
  if (current) {
    let end = Math.max(...covering.map((period) => period.endsAt.getTime()));
    for (const period of [...active].sort(byStart)) {
      if (period.startsAt.getTime() <= end && period.endsAt.getTime() > end) {
        end = period.endsAt.getTime();
      }
    }
    proUntil = new Date(end);
  }

  const upcoming = active
    .filter((period) => period.startsAt.getTime() > time)
    .sort(byStart);
  const history = periods
    .filter(
      (period) =>
        period.status === 'cancelled' || period.endsAt.getTime() <= time,
    )
    .sort((a, b) => byStart(b, a));

  let graceUntil: Date | null = null;
  if (!current) {
    const ended = active.filter((period) => period.endsAt.getTime() <= time);
    if (ended.length > 0) {
      const lastEnd = Math.max(
        ...ended.map((period) => period.endsAt.getTime()),
      );
      const end = proGraceEnd(new Date(lastEnd));
      if (end.getTime() > time) graceUntil = end;
    }
  }

  return {
    isPro: current !== null,
    proUntil,
    inGrace: graceUntil !== null,
    graceUntil,
    current,
    upcoming,
    history,
  };
}

/**
 * Whether a merchant is Pro or in its grace now; reads only periods that have
 * not ended or ended recently enough to still give a grace.
 */
export async function merchantProStatus(
  manager: EntityManager,
  merchantId: string,
  now = new Date(),
): Promise<ProStatus> {
  const periods = await manager.find(MerchantProPeriod, {
    where: {
      merchantId,
      status: 'active',
      endsAt: MoreThan(new Date(now.getTime() - (PRO_GRACE_DAYS + 1) * DAY_MS)),
    },
  });
  const { isPro, proUntil, inGrace, graceUntil } = groupProPeriods(
    periods,
    now,
  );
  return { isPro, proUntil, inGrace, graceUntil };
}
