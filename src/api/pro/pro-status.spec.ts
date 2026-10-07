import { MerchantProPeriod } from './entities/merchant-pro-period.entity';
import { groupProPeriods } from './pro-status';

const day = (date: string) => new Date(`${date}T00:00:00+07:00`);
let next = 0;
const period = (
  starts: string,
  ends: string,
  status: 'active' | 'cancelled' = 'active',
): MerchantProPeriod =>
  ({
    id: `period-${(next += 1)}`,
    startsAt: day(starts),
    endsAt: day(ends),
    status,
  }) as MerchantProPeriod;

describe('groupProPeriods', () => {
  const now = day('2026-10-15');

  it('is not Pro without periods', () => {
    expect(groupProPeriods([], now)).toEqual({
      isPro: false,
      proUntil: null,
      current: null,
      upcoming: [],
      history: [],
    });
  });

  it('is Pro inside a period until its end', () => {
    const october = period('2026-10-01', '2026-11-01');
    const result = groupProPeriods([october], now);
    expect(result.isPro).toBe(true);
    expect(result.proUntil).toEqual(day('2026-11-01'));
    expect(result.current).toBe(october);
  });

  it('follows back-to-back periods to the last end', () => {
    const october = period('2026-10-01', '2026-11-01');
    const november = period('2026-11-01', '2026-12-01');
    const result = groupProPeriods([november, october], now);
    expect(result.proUntil).toEqual(day('2026-12-01'));
    expect(result.upcoming).toEqual([november]);
  });

  it('stops at a gap', () => {
    const october = period('2026-10-01', '2026-11-01');
    const december = period('2026-12-01', '2027-01-01');
    const result = groupProPeriods([october, december], now);
    expect(result.proUntil).toEqual(day('2026-11-01'));
    expect(result.upcoming).toEqual([december]);
  });

  it('is not Pro after the end, and lists the ended period', () => {
    const september = period('2026-09-01', '2026-10-01');
    const result = groupProPeriods([september], now);
    expect(result).toMatchObject({ isPro: false, proUntil: null });
    expect(result.history).toEqual([september]);
  });

  it('ignores a cancelled period covering now', () => {
    const cancelled = period('2026-10-01', '2026-11-01', 'cancelled');
    const result = groupProPeriods([cancelled], now);
    expect(result.isPro).toBe(false);
    expect(result.history).toEqual([cancelled]);
  });

  it('is not Pro yet with only a future period', () => {
    const future = period('2026-10-20', '2026-11-20');
    const result = groupProPeriods([future], now);
    expect(result).toMatchObject({ isPro: false, upcoming: [future] });
  });

  it('gives one answer for overlapping manual grants', () => {
    const first = period('2026-10-01', '2026-11-01');
    const overlap = period('2026-10-10', '2026-11-15');
    const result = groupProPeriods([overlap, first], now);
    expect(result.current).toBe(first);
    expect(result.proUntil).toEqual(day('2026-11-15'));
  });

  it('lists history newest first', () => {
    const july = period('2026-07-01', '2026-08-01');
    const september = period('2026-09-01', '2026-10-01');
    expect(groupProPeriods([july, september], now).history).toEqual([
      september,
      july,
    ]);
  });
});
