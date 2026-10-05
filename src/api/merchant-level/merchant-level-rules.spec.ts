import { MerchantStorageLevel } from '../merchant/entities/merchant.entity';
import {
  InactivityFacts,
  inactivityAction,
  levelForRevenue,
  nextLevel,
} from './merchant-level-rules';
import { addMonths } from './merchant-level.service';

const { BASIC, SILVER, GOLD } = MerchantStorageLevel;
const MILLION = 1_000_000;

describe('nextLevel', () => {
  it.each([
    ['Basic jumps straight to Gold', BASIC, 6 * MILLION, 0, GOLD],
    ['Basic reaches Silver', BASIC, 3 * MILLION, 0, SILVER],
    ['Basic stays Basic', BASIC, 2_499_999, 0, BASIC],
    ['exactly 2.5 million is Silver', BASIC, 2.5 * MILLION, 0, SILVER],
    ['exactly 5 million is Gold', SILVER, 5 * MILLION, 0, GOLD],
    ['Gold stays Gold', GOLD, 5 * MILLION, 0, GOLD],
    ['Gold drops to Silver', GOLD, 3 * MILLION, 9 * MILLION, SILVER],
    ['Gold drops one level, however low', GOLD, 0, 9 * MILLION, SILVER],
    [
      'Gold under 2.5 million drops to Silver',
      GOLD,
      MILLION,
      9 * MILLION,
      SILVER,
    ],
    ['just under 5 million drops Gold to Silver', GOLD, 4_999_999, 0, SILVER],
    ['Silver rises to Gold', SILVER, 7 * MILLION, 0, GOLD],
    ['Silver stays Silver', SILVER, 3 * MILLION, MILLION, SILVER],
    [
      'Silver keeps its level after one low month',
      SILVER,
      MILLION,
      3 * MILLION,
      SILVER,
    ],
    [
      'Silver drops to Basic after two low months',
      SILVER,
      MILLION,
      MILLION,
      BASIC,
    ],
  ])('%s', (_name, current, revenue, previous, expected) => {
    expect(nextLevel(current, revenue, previous)).toBe(expected);
  });

  it('takes Gold to Silver, then Basic, over two low months', () => {
    const september = nextLevel(GOLD, MILLION, 9 * MILLION);
    const october = nextLevel(september, MILLION, MILLION);

    expect([september, october]).toEqual([SILVER, BASIC]);
  });

  it('maps revenue to the level it reaches', () => {
    expect(levelForRevenue(0)).toBe(BASIC);
    expect(levelForRevenue(4_999_999)).toBe(SILVER);
    expect(levelForRevenue(10 * MILLION)).toBe(GOLD);
  });
});

describe('inactivityAction', () => {
  const quiet: InactivityFacts = {
    hasItems: true,
    monthHasSale: false,
    previousMonthHasSale: false,
    monthCounted: true,
    previousMonthCounted: true,
    previousAction: null,
  };

  it('warns after two counted months without a sale', () => {
    expect(inactivityAction(quiet)).toBe('warning');
  });

  it('removes a month after the warning when there is still no sale', () => {
    expect(inactivityAction({ ...quiet, previousAction: 'warning' })).toBe(
      'removed',
    );
  });

  it('a sale in the month clears everything, even after a warning', () => {
    expect(
      inactivityAction({
        ...quiet,
        monthHasSale: true,
        previousAction: 'warning',
      }),
    ).toBe('none');
  });

  it('a sale in the previous month means no warning yet', () => {
    expect(inactivityAction({ ...quiet, previousMonthHasSale: true })).toBe(
      'none',
    );
  });

  it('never warns over months before tracking or a removal', () => {
    expect(inactivityAction({ ...quiet, previousMonthCounted: false })).toBe(
      'none',
    );
    expect(
      inactivityAction({
        ...quiet,
        monthCounted: false,
        previousMonthCounted: false,
      }),
    ).toBe('none');
  });

  it('does nothing for a merchant without items', () => {
    expect(
      inactivityAction({
        ...quiet,
        hasItems: false,
        previousAction: 'warning',
      }),
    ).toBe('none');
  });

  it('warns again after a removal only once two new months have passed', () => {
    // Removal evaluated for October: November is the first counted month.
    expect(
      inactivityAction({
        ...quiet,
        previousAction: 'removed',
        previousMonthCounted: false,
      }),
    ).toBe('none');
    expect(inactivityAction({ ...quiet, previousAction: 'none' })).toBe(
      'warning',
    );
  });
});

describe('addMonths', () => {
  it('moves across year boundaries', () => {
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
  });
});
