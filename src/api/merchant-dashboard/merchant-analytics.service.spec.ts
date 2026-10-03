import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { MerchantIncomeService } from '../merchant-income/merchant-income.service';
import {
  AnalyticsSummaryQueryDto,
  DailySalesQueryDto,
  MonthlyRevenueQueryDto,
  StudentGrowthQueryDto,
  TrackVisitDto,
} from './dto/merchant-analytics.dto';
import {
  MerchantAnalyticsService,
  averageOrderValue,
  checkpointCount,
  conversion,
  defaultGranularity,
  metric,
  retention,
} from './merchant-analytics.service';
import { VisitTrackingService } from './visit-tracking.service';

const window = (counts: {
  transactions?: number;
  revenue?: number;
  buyers?: number;
  returning_buyers?: number;
  visitors?: number;
}) => ({
  from: '2026-10-01T00:00:00',
  to: '2026-10-01T12:00:00',
  transactions: 0,
  revenue: 0,
  buyers: 0,
  returning_buyers: 0,
  visitors: 0,
  ...counts,
});

async function errorFields(target: new () => object, value: object) {
  const errors = await validate(plainToInstance(target, value));
  return errors.map((error) => error.property);
}

describe('analytics formulas', () => {
  it.each([
    [{ from: '2026-03-01', to: '2026-03-31' }, 'day'],
    [{ from: '2026-01-01', to: '2026-06-30' }, 'month'],
    [{ from: '2025-11-01', to: '2026-02-01' }, 'year'],
  ])('picks the page granularity for %j', (range, expected) => {
    expect(defaultGranularity(range)).toBe(expected);
  });

  it('counts checkpoints', () => {
    expect(checkpointCount('2026-01-01', '2026-06-30', 'day')).toBe(181);
    expect(checkpointCount('2025-11-15', '2026-02-01', 'month')).toBe(4);
    expect(checkpointCount('2020-06-01', '2026-01-01', 'year')).toBe(7);
  });

  it('caps conversion at 100 and leaves it empty without visitors', () => {
    expect(conversion(window({ buyers: 3, visitors: 5 }))).toBe(60);
    expect(conversion(window({ buyers: 9, visitors: 5 }))).toBe(100);
    expect(conversion(window({ buyers: 3 }))).toBeNull();
  });

  it('computes retention and average order value', () => {
    expect(retention(window({ buyers: 3, returning_buyers: 1 }))).toBe(33.3);
    expect(retention(window({}))).toBeNull();
    expect(
      averageOrderValue(window({ transactions: 3, revenue: 600001 })),
    ).toBe(200000);
    expect(averageOrderValue(window({}))).toBeNull();
  });

  it('reports the change only against a non-zero previous value', () => {
    expect(metric(200000, 400000)).toEqual({
      value: 200000,
      previous: 400000,
      change_percent: -50,
    });
    expect(metric(10, 0).change_percent).toBeNull();
    expect(metric(10, null).change_percent).toBeNull();
    expect(metric(null, 10).change_percent).toBeNull();
  });
});

describe('analytics DTOs', () => {
  it.each([
    [StudentGrowthQueryDto, { from: '2026-01-01', to: '2026-02-30' }, ['to']],
    [
      StudentGrowthQueryDto,
      { from: '2026-01-01', to: '2026-02-01', granularity: 'week' },
      ['granularity'],
    ],
    [DailySalesQueryDto, { month: '2026-13' }, ['month']],
    [DailySalesQueryDto, { month: '2026-10' }, []],
    [MonthlyRevenueQueryDto, { year: '1999' }, ['year']],
    [MonthlyRevenueQueryDto, { year: '2026' }, []],
    [DailySalesQueryDto, {}, []],
    [DailySalesQueryDto, { month: '' }, []],
    [MonthlyRevenueQueryDto, {}, []],
    [MonthlyRevenueQueryDto, { year: '' }, []],
    [AnalyticsSummaryQueryDto, {}, []],
    [AnalyticsSummaryQueryDto, { period: 'Year' }, []],
    [AnalyticsSummaryQueryDto, { period: 'week' }, ['period']],
    [TrackVisitDto, { target_type: 'Storefront', target_id: 'toko' }, []],
    [
      TrackVisitDto,
      { target_type: 'page', target_id: 'x', visitor_id: 'x' },
      ['target_type', 'visitor_id'],
    ],
  ])('validates %p %j', async (target, value, fields) => {
    expect(await errorFields(target as never, value)).toEqual(fields);
  });
});

describe('TrackVisitDto target_type', () => {
  const targetId = '30000000-0000-4000-8000-000000000001';
  const errorsFor = async (target_type: string) =>
    validate(
      plainToInstance(TrackVisitDto, { target_type, target_id: targetId }),
      {
        whitelist: true,
        forbidNonWhitelisted: true,
      },
    );

  it.each(['storefront', 'kelas', 'bootcamp', 'digital', 'bundle'])(
    'accepts %s',
    async (targetType) => {
      expect(await errorsFor(targetType)).toEqual([]);
    },
  );

  it.each(['class', 'digital_product', 'video', 'live-bootcamp'])(
    'rejects the old value %s',
    async (targetType) => {
      const errors = await errorsFor(targetType);
      expect(errors.map((error) => error.property)).toEqual(['target_type']);
    },
  );
});

describe('MerchantAnalyticsService', () => {
  let query: jest.Mock;
  let findIncome: jest.Mock;
  let service: MerchantAnalyticsService;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue([{ id: 'merchant-id' }]);
    findIncome = jest.fn().mockResolvedValue([]);
    service = new MerchantAnalyticsService(
      { query } as unknown as DataSource,
      { findIncome } as unknown as MerchantIncomeService,
    );
  });

  it('needs a merchant', async () => {
    query.mockResolvedValue([]);
    await expect(
      service.findDailySales('user-id', '2026-10'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a reversed range and too many checkpoints before querying', async () => {
    await expect(
      service.findStudentGrowth('user-id', {
        from: '2026-06-30',
        to: '2026-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.findStudentGrowth('user-id', {
        from: '2020-01-01',
        to: '2026-12-31',
        granularity: 'day',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('rejects a range longer than 10 years', async () => {
    await expect(
      service.findStudentGrowth('user-id', {
        from: '2016-01-01',
        to: '2026-01-02',
        granularity: 'year',
      }),
    ).rejects.toThrow('from and to must be at most 10 years apart');
    const { data } = await service.findStudentGrowth('user-id', {
      from: '2016-01-01',
      to: '2026-01-01',
      granularity: 'year',
    });
    expect(data.granularity).toBe('year');
  });

  it('fills every day of the month and totals the daily series', async () => {
    findIncome.mockResolvedValueOnce([
      { period: '2026-10-01', transactions: 2, revenue: '280000' },
      { period: '2026-10-31', transactions: 1, revenue: '20000.5' },
    ]);
    const { data } = await service.findDailySales('user-id', '2026-10');
    expect(findIncome).toHaveBeenCalledWith(
      'merchant-id',
      '2026-10-01',
      '2026-10-31',
      'day',
    );
    expect(data.days).toHaveLength(31);
    expect(data).toMatchObject({
      total_transactions: 3,
      total_revenue: 300000.5,
    });
    expect(data.days[0]).toEqual({
      date: '2026-10-01',
      transactions: 2,
      revenue: 280000,
    });
    expect(data.days[1]).toEqual({
      date: '2026-10-02',
      transactions: 0,
      revenue: 0,
    });
  });

  it('places monthly income in its month and fills the others with 0', async () => {
    findIncome.mockResolvedValueOnce([
      { period: '2026-02-01', transactions: 4, revenue: '400000' },
      { period: '2026-12-01', transactions: 1, revenue: '50000' },
    ]);
    const { data } = await service.findMonthlyRevenue('user-id', 2026);
    expect(findIncome).toHaveBeenCalledWith(
      'merchant-id',
      '2026-01-01',
      '2026-12-31',
      'month',
    );
    expect(data.months).toHaveLength(12);
    expect(data.months[0]).toEqual({ month: 1, total: 0 });
    expect(data.months[1]).toEqual({ month: 2, total: 400000 });
    expect(data.months[11]).toEqual({ month: 12, total: 50000 });
    expect(data.total_revenue).toBe(450000);
  });
});

describe('analytics defaults', () => {
  let query: jest.Mock;
  let findIncome: jest.Mock;
  let service: MerchantAnalyticsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-31T18:30:00Z'));
    query = jest.fn().mockResolvedValue([{ id: 'merchant-id' }]);
    findIncome = jest.fn().mockResolvedValue([]);
    service = new MerchantAnalyticsService(
      { query } as unknown as DataSource,
      { findIncome } as unknown as MerchantIncomeService,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('uses the current Asia/Jakarta month and year', async () => {
    // 18:30 UTC on 31 October is already 1 November in Jakarta.
    const daily = await service.findDailySales('user-id');
    expect(findIncome).toHaveBeenLastCalledWith(
      'merchant-id',
      '2026-11-01',
      '2026-11-30',
      'day',
    );
    expect(daily.data.month).toBe('2026-11');
    expect(daily.data.days).toHaveLength(30);

    const monthly = await service.findMonthlyRevenue('user-id');
    expect(findIncome).toHaveBeenLastCalledWith(
      'merchant-id',
      '2026-01-01',
      '2026-12-31',
      'month',
    );
    expect(monthly.data.year).toBe(2026);
  });

  it('summarises the month by default', async () => {
    query
      .mockResolvedValueOnce([{ id: 'merchant-id' }])
      .mockResolvedValueOnce([]);
    await service.findSummary('user-id').catch(() => undefined);
    expect(query.mock.calls[1][1]).toEqual(['merchant-id', 'month']);
  });

  it('parses the documented values', () => {
    expect(
      plainToInstance(AnalyticsSummaryQueryDto, { period: ' Year ' }).period,
    ).toBe('year');
    expect(plainToInstance(MonthlyRevenueQueryDto, { year: '2025' }).year).toBe(
      2025,
    );
  });
});

describe('VisitTrackingService', () => {
  let query: jest.Mock;
  let execute: jest.Mock;
  let values: jest.Mock;
  let service: VisitTrackingService;
  const input = {
    target_type: 'storefront' as const,
    target_id: 'toko-budi',
    visitor_id: '9f1c2c8e-0d6a-4d55-9f7e-2f7f1f6c1a11',
  };

  beforeEach(() => {
    query = jest
      .fn()
      .mockResolvedValue([{ id: 'merchant-id', user_id: 'owner-id' }]);
    execute = jest.fn();
    values = jest.fn(() => ({ orIgnore: () => ({ execute }) }));
    const builder = { insert: () => ({ into: () => ({ values }) }) };
    service = new VisitTrackingService({
      query,
      createQueryBuilder: () => builder,
    } as unknown as DataSource);
  });

  it('records an anonymous visitor by browser id', async () => {
    await expect(
      service.track(input, null, 'Mozilla/5.0'),
    ).resolves.toMatchObject({ data: { recorded: true } });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-id',
        visitorKey: `anon:${input.visitor_id}`,
        userId: null,
      }),
    );
    expect(query.mock.calls[0][0]).toContain('profile.slug = $1');
  });

  it('needs a visitor id only without a login', async () => {
    const withoutVisitor = { ...input, visitor_id: undefined };
    await expect(
      service.track(withoutVisitor, null, 'Mozilla/5.0'),
    ).rejects.toThrow(
      'visitor_id is required when the request has no login token',
    );
    await service.track(withoutVisitor, 'user-id', 'Mozilla/5.0');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ visitorKey: 'user:user-id' }),
    );
  });

  it('keys a logged-in visitor by user', async () => {
    await service.track(input, 'user-id', 'Mozilla/5.0');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        visitorKey: 'user:user-id',
        userId: 'user-id',
      }),
    );
  });

  it.each([
    ['the owner', 'owner-id', 'Mozilla/5.0'],
    ['a crawler', null, 'Googlebot/2.1'],
  ])('ignores %s', async (_label, userId, userAgent) => {
    await expect(
      service.track(input, userId, userAgent),
    ).resolves.toMatchObject({ data: { recorded: false } });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a hidden page and a non-UUID class id', async () => {
    query.mockResolvedValue([]);
    await expect(service.track(input, null, 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.track(
        { ...input, target_type: 'kelas', target_id: 'abc' },
        null,
        'x',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['kelas', 'FROM classes class'],
    ['bootcamp', 'FROM classes class'],
    ['digital', 'FROM products product'],
    ['bundle', 'FROM bundles bundle'],
  ] as const)('resolves a %s page to its merchant', async (kind, table) => {
    const targetId = '30000000-0000-4000-8000-000000000001';

    await service.track(
      { ...input, target_type: kind, target_id: targetId },
      null,
      'Mozilla/5.0',
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain(table);
    expect(params).toEqual([targetId]);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-id' }),
    );
  });

  it('counts only published or unlisted bundles', async () => {
    await service.track(
      {
        ...input,
        target_type: 'bundle',
        target_id: '30000000-0000-4000-8000-000000000001',
      },
      null,
      'Mozilla/5.0',
    );

    expect(query.mock.calls[0][0]).toContain(
      "bundle.status IN ('published', 'unlisted')",
    );
  });
});
