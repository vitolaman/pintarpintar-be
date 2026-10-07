import { EntityManager, MoreThan } from 'typeorm';
import { MerchantProPeriod } from './entities/merchant-pro-period.entity';

export interface ProStatus {
  isPro: boolean;
  /** End of the Pro time that continues from now without a gap. */
  proUntil: Date | null;
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

  return { isPro: current !== null, proUntil, current, upcoming, history };
}

/** Whether a merchant is Pro now; reads only periods that have not ended. */
export async function merchantProStatus(
  manager: EntityManager,
  merchantId: string,
  now = new Date(),
): Promise<ProStatus> {
  const periods = await manager.find(MerchantProPeriod, {
    where: {
      merchantId,
      status: 'active',
      endsAt: MoreThan(now),
    },
  });
  const { isPro, proUntil } = groupProPeriods(periods, now);
  return { isPro, proUntil };
}
