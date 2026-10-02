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
  let service: MerchantDashboardService;

  beforeEach(() => {
    query = jest.fn();
    service = new MerchantDashboardService(
      { query } as unknown as DataSource,
      {
        findSummary: jest.fn().mockResolvedValue({ current: 'basic' }),
      } as unknown as MerchantLevelService,
    );
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
    expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPage: 1 });
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
