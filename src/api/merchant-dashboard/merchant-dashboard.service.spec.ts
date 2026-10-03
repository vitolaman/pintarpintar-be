import { MerchantIncomeService } from '../merchant-income/merchant-income.service';
import { MerchantLevelService } from '../merchant-level/merchant-level.service';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import {
  CustomersQueryDto,
  DashboardQueryDto,
  SalesQueryDto,
} from './dto/merchant-dashboard-query.dto';
import {
  MerchantDashboardService,
  periodMetric,
} from './merchant-dashboard.service';

const ITEM_ID = '10000000-0000-4000-8000-000000000001';

describe('periodMetric', () => {
  it.each([
    [1000000, 800000, 25],
    [10, 8, 25],
    [7, 6, 16.7],
    [0, 5, -100],
    [5, 0, null],
  ])('%p vs %p changes %p percent', (current, previous, change) => {
    expect(periodMetric(current, previous)).toEqual({
      current,
      previous,
      change_percent: change,
    });
  });
});

describe('Dashboard query DTOs', () => {
  it('defaults the dashboard to 30 days and rejects other periods', async () => {
    expect(plainToInstance(DashboardQueryDto, {}).period_days).toBe(30);
    expect(
      await validate(plainToInstance(DashboardQueryDto, { period_days: '14' })),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(DashboardQueryDto, { period_days: '365' }),
      ),
    ).toHaveLength(0);
  });

  it('parses comma-separated item ids and validates them', async () => {
    const valid = plainToInstance(SalesQueryDto, {
      item_ids: `${ITEM_ID}, ${ITEM_ID}`,
    });
    expect(valid.item_ids).toEqual([ITEM_ID, ITEM_ID]);
    expect(await validate(valid)).toHaveLength(0);
    expect(
      await validate(plainToInstance(SalesQueryDto, { item_ids: 'abc' })),
    ).not.toHaveLength(0);
  });

  it.each([
    [SalesQueryDto, { type: 'gift' }],
    [SalesQueryDto, { sort_by: 'buyer' }],
    [CustomersQueryDto, { sort_by: 'email' }],
    [CustomersQueryDto, { sort_order: 'up' }],
  ])('rejects %p %j', async (type, query) => {
    expect(
      await validate(plainToInstance(type as never, query)),
    ).not.toHaveLength(0);
  });

  it('treats a blank period as the default period', async () => {
    const query = plainToInstance(DashboardQueryDto, { period_days: '' });

    expect(await validate(query)).toHaveLength(0);
    expect(query.period_days).toBe(30);
  });

  it('treats blank sales filters as no filter and keeps the default sort', async () => {
    const query = plainToInstance(SalesQueryDto, {
      type: '',
      status: ' ',
      search: '',
      item_ids: '',
      sort_by: '',
      sort_order: '',
    });

    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({
      type: undefined,
      status: undefined,
      search: undefined,
      sort_by: 'date',
      sort_order: 'desc',
    });
    expect(query.item_ids).toEqual([]);
  });

  it('treats a blank customer search and sort as none and the default', async () => {
    const query = plainToInstance(CustomersQueryDto, {
      search: '  ',
      sort_by: '',
      sort_order: ' ',
    });

    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({
      search: undefined,
      sort_by: 'total_spent',
      sort_order: 'desc',
    });
  });

  it('matches sales and customer enums ignoring case and spaces', async () => {
    const sales = plainToInstance(SalesQueryDto, {
      type: ' Bootcamp ',
      status: 'PAID',
      sort_by: 'Amount',
      sort_order: 'ASC',
      search: ' Budi ',
    });
    const customers = plainToInstance(CustomersQueryDto, {
      sort_by: 'Joined_At',
      sort_order: ' Asc',
    });

    expect(await validate(sales)).toHaveLength(0);
    expect(sales).toMatchObject({
      type: 'bootcamp',
      status: 'paid',
      sort_by: 'amount',
      sort_order: 'asc',
      search: 'Budi',
    });
    expect(await validate(customers)).toHaveLength(0);
    expect(customers).toMatchObject({
      sort_by: 'joined_at',
      sort_order: 'asc',
    });
  });

  it('rejects an unknown sale status', async () => {
    const errors = await validate(
      plainToInstance(SalesQueryDto, { status: 'refunded' }),
    );
    expect(errors.map((error) => error.property)).toEqual(['status']);
  });
});

describe('MerchantDashboardService', () => {
  let query: jest.Mock;
  let findIncome: jest.Mock;
  let service: MerchantDashboardService;

  beforeEach(() => {
    query = jest.fn();
    findIncome = jest.fn().mockResolvedValue([]);
    service = new MerchantDashboardService(
      { query } as unknown as DataSource,
      {
        findSummary: jest.fn().mockResolvedValue({ current: 'basic' }),
      } as unknown as MerchantLevelService,
      { findIncome } as unknown as MerchantIncomeService,
    );
  });

  describe('income periods', () => {
    // 18:30 UTC on 31 October is already 1 November in Jakarta.
    beforeEach(() =>
      jest.useFakeTimers().setSystemTime(new Date('2026-10-31T18:30:00Z')),
    );
    afterEach(() => jest.useRealTimers());

    it('covers today and the N - 1 days before it, then the N days before that', async () => {
      query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM merchants')) {
          return [{ id: 'merchant-id', storage_level: 'basic' }];
        }
        if (sql.includes('previous_students')) {
          return [{ students: 3, previous_students: 4 }];
        }
        return [{}];
      });
      findIncome.mockResolvedValue([
        { period: '2026-10-25', transactions: 2, revenue: '50000' },
        { period: '2026-10-26', transactions: 1, revenue: '100000' },
        { period: '2026-11-01', transactions: 3, revenue: '25000' },
      ]);

      const { data } = await service.findDashboard(
        'user-id',
        plainToInstance(DashboardQueryDto, { period_days: 7 }),
      );

      expect(findIncome).toHaveBeenCalledWith(
        'merchant-id',
        '2026-10-19',
        '2026-11-01',
        'day',
      );
      const buyersCall = query.mock.calls.find(([sql]) =>
        String(sql).includes('previous_students'),
      );
      expect(buyersCall[1]).toEqual([
        'merchant-id',
        '2026-10-19',
        '2026-10-26',
        '2026-11-01',
      ]);
      expect(data.revenue).toEqual({
        current: 125000,
        previous: 50000,
        change_percent: 150,
      });
      expect(data.transactions).toEqual({
        current: 4,
        previous: 2,
        change_percent: 100,
      });
      expect(data.students).toMatchObject({ current: 3, previous: 4 });
      expect(data.chart.map((point) => point.date)).toEqual([
        '2026-10-26',
        '2026-10-27',
        '2026-10-28',
        '2026-10-29',
        '2026-10-30',
        '2026-10-31',
        '2026-11-01',
      ]);
      expect(data.chart[0]).toEqual({
        date: '2026-10-26',
        transactions: 1,
        revenue: 100000,
      });
      expect(data.chart[1]).toEqual({
        date: '2026-10-27',
        transactions: 0,
        revenue: 0,
      });
    });
  });

  it('rates and lists reviews of both classes and digital products', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM merchants')) {
        return [{ id: 'merchant-id', storage_level: 'basic' }];
      }
      if (sql.includes('round(avg(review.rating)')) {
        return [{ average: '4.5', total: 2 }];
      }
      if (sql.includes('reviewer_avatar_object_key')) {
        return [{ rating: 5, item_title: 'Belajar AutoCAD dari Nol' }];
      }
      if (sql.includes('AS catalog') || sql.includes(') catalog')) {
        return [{ total: 3, new_in_period: 1 }];
      }
      return [{}];
    });

    const { data } = await service.findDashboard(
      'user-id',
      plainToInstance(DashboardQueryDto, {}),
    );

    const reviewQueries = query.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => sql.includes('FROM reviews review'));
    expect(reviewQueries).toHaveLength(3);
    for (const sql of reviewQueries) {
      expect(sql).toContain(
        'LEFT JOIN classes class ON class.id = review.class_id',
      );
      expect(sql).toContain(
        'class.merchant_id = $1 OR product.merchant_id = $1',
      );
    }
    expect(data).toMatchObject({
      rating_average: 4.5,
      review_count: 2,
      latest_review: { rating: 5, item_title: 'Belajar AutoCAD dari Nol' },
    });
  });

  it('returns the latest reviewer avatar as a URL only', async () => {
    process.env.ASSET_PUBLIC_BASE_URL = 'https://cdn.example.com';
    try {
      query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM merchants')) {
          return [{ id: 'merchant-id', storage_level: 'basic' }];
        }
        if (sql.includes('reviewer_avatar_object_key')) {
          return [
            {
              reviewer_name: 'Alya',
              reviewer_avatar_object_key: 'avatars/alya.png',
              rating: '5',
              comment: 'Bagus',
              item_title: 'AutoCAD',
              created_at: new Date('2026-09-01T00:00:00.000Z'),
            },
          ];
        }
        return [{}];
      });

      const { data } = await service.findDashboard(
        'user-id',
        plainToInstance(DashboardQueryDto, {}),
      );

      expect(data.latest_review).toEqual({
        reviewer_name: 'Alya',
        reviewer_avatar_url: 'https://cdn.example.com/avatars/alya.png',
        rating: 5,
        comment: 'Bagus',
        item_title: 'AutoCAD',
        created_at: new Date('2026-09-01T00:00:00.000Z'),
      });
    } finally {
      delete process.env.ASSET_PUBLIC_BASE_URL;
    }
  });

  it('returns a null reviewer avatar URL without an avatar', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM merchants')) {
        return [{ id: 'merchant-id', storage_level: 'basic' }];
      }
      if (sql.includes('reviewer_avatar_object_key')) {
        return [{ reviewer_avatar_object_key: null, rating: 4 }];
      }
      return [{}];
    });

    const { data } = await service.findDashboard(
      'user-id',
      plainToInstance(DashboardQueryDto, {}),
    );

    expect(data.latest_review.reviewer_avatar_url).toBeNull();
  });

  it('rejects users without a merchant', async () => {
    query.mockResolvedValueOnce([]);
    await expect(
      service.findSales('user-id', plainToInstance(SalesQueryDto, {})),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('binds sales filters as parameters and sorts by a whitelisted column', async () => {
    query
      .mockResolvedValueOnce([{ id: 'merchant-id', storage_level: 'basic' }])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          id: 'item',
          order_id: 'order',
          ordered_at: new Date('2026-09-28T00:00:00Z'),
          buyer_name: 'Rina Kartika',
          buyer_phone: '+6281234567806',
          type: 'kelas',
          item_id: ITEM_ID,
          item_title: 'AutoCAD 3D',
          amount: '359100',
          gross_amount: '399000',
          coupon_code: 'HEMAT10',
          payment_method: 'BC',
          status: 'paid',
        },
      ]);

    const result = await service.findSales(
      'user-id',
      plainToInstance(SalesQueryDto, {
        type: 'kelas',
        search: '50%_',
        sort_by: 'amount',
        sort_order: 'asc',
        item_ids: ITEM_ID,
      }),
    );

    const [pageSql, pageParams] = query.mock.calls[2];
    expect(pageParams).toEqual([
      'merchant-id',
      'kelas',
      null,
      '50\\%\\_',
      [ITEM_ID],
      10,
      0,
    ]);
    expect(pageSql).toContain('ORDER BY sale.amount ASC, sale.id ASC');
    expect(result.data[0]).toMatchObject({
      amount: 399000,
      net_amount: 359100,
      payment_method: 'BC',
      platform_fee: null,
      transaction_fee: null,
    });
    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      total_page: 1,
    });
  });

  it('reports export truncation beyond 5000 rows', async () => {
    const rows = Array.from({ length: 5001 }, (_, index) => ({
      id: String(index),
      amount: '1',
    }));
    query
      .mockResolvedValueOnce([{ id: 'merchant-id', storage_level: 'basic' }])
      .mockResolvedValueOnce(rows);

    const { data } = await service.exportSales(
      'user-id',
      plainToInstance(SalesQueryDto, {}),
    );

    expect(query.mock.calls[1][1].slice(-2)).toEqual([5001, 0]);
    expect(data.rows).toHaveLength(5000);
    expect(data.truncated).toBe(true);
  });
});
