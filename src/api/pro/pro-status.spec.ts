import { MerchantProPeriod } from './entities/merchant-pro-period.entity';
import { groupProPeriods, hasProBenefits, proGraceEnd } from './pro-status';

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
      inGrace: false,
      graceUntil: null,
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

describe('Pro grace after the Pro time ends', () => {
  const at = (iso: string) => new Date(iso);
  // Pro ended on 31 October 2026 at 10.00 WIB.
  const ended = () =>
    ({
      id: 'ended',
      startsAt: at('2026-10-01T10:00:00+07:00'),
      endsAt: at('2026-10-31T10:00:00+07:00'),
      status: 'active',
    }) as MerchantProPeriod;

  it('ends at 00.00 WIB of the seventh date after the end', () => {
    expect(proGraceEnd(at('2026-10-31T10:00:00+07:00'))).toEqual(
      at('2026-11-07T00:00:00+07:00'),
    );
    // 23.30 WIB on 31 October is still the 31st in Jakarta.
    expect(proGraceEnd(at('2026-10-31T16:30:00Z'))).toEqual(
      at('2026-11-07T00:00:00+07:00'),
    );
  });

  it.each([
    ['2026-10-31T09:00:00+07:00', true, false, null],
    ['2026-10-31T11:00:00+07:00', false, true, '2026-11-07T00:00:00+07:00'],
    ['2026-11-06T23:59:00+07:00', false, true, '2026-11-07T00:00:00+07:00'],
    ['2026-11-07T00:00:00+07:00', false, false, null],
  ])('at %s: Pro %s, grace %s until %s', (now, isPro, inGrace, until) => {
    const result = groupProPeriods([ended()], at(now));
    expect(result.isPro).toBe(isPro);
    expect(result.inGrace).toBe(inGrace);
    expect(result.graceUntil).toEqual(until ? at(until) : null);
    expect(hasProBenefits(result)).toBe(isPro || inGrace);
  });

  it('has no grace while a renewal covers now', () => {
    const renewal = {
      id: 'renewal',
      startsAt: at('2026-10-31T10:00:00+07:00'),
      endsAt: at('2026-11-30T10:00:00+07:00'),
      status: 'active',
    } as MerchantProPeriod;
    const result = groupProPeriods(
      [ended(), renewal],
      at('2026-11-02T08:00:00+07:00'),
    );
    expect(result).toMatchObject({
      isPro: true,
      inGrace: false,
      graceUntil: null,
    });
  });

  it('gives no grace for a cancelled period', () => {
    const cancelled = { ...ended(), status: 'cancelled' } as MerchantProPeriod;
    expect(
      groupProPeriods([cancelled], at('2026-11-01T08:00:00+07:00')).inGrace,
    ).toBe(false);
  });
});
