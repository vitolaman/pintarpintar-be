import { DataSource, EntityManager } from 'typeorm';
import { MerchantDailyStat } from './entities/merchant-daily-stat.entity';
import { MerchantIncomeJobsService } from './merchant-income-jobs.service';
import { MerchantIncomeService } from './merchant-income.service';

function incomeRow(index: number) {
  return {
    merchant_id: `merchant-${index}`,
    stat_date: '2026-10-01',
    revenue: '1000',
    orders: 1,
    visitors: 2,
  };
}

describe('MerchantIncomeService', () => {
  let query: jest.Mock;
  let insert: jest.Mock;
  let where: jest.Mock;
  let service: MerchantIncomeService;
  let dailyRows: ReturnType<typeof incomeRow>[];
  let locked: boolean;

  beforeEach(() => {
    dailyRows = [];
    locked = true;
    insert = jest.fn();
    where = jest.fn().mockReturnValue({ execute: jest.fn() });
    query = jest.fn(async (sql: string) => {
      if (sql.includes('pg_try_advisory_xact_lock')) return [{ locked }];
      if (sql.includes('AS from_date')) {
        return [{ from_date: '2026-09-26', to_date: '2026-10-02' }];
      }
      if (sql.includes('FULL JOIN visits')) return dailyRows;
      return [];
    });
    const manager = {
      query,
      insert,
      createQueryBuilder: () => ({
        delete: () => ({ from: () => ({ where }) }),
      }),
    } as unknown as EntityManager;
    service = new MerchantIncomeService({
      transaction: (work: (manager: EntityManager) => unknown) => work(manager),
      manager,
    } as unknown as DataSource);
  });

  it('replaces the recent days under the lock and inserts in chunks', async () => {
    dailyRows = Array.from({ length: 2500 }, (_, index) => incomeRow(index));

    expect(await service.refreshRecentDays()).toBe(2500);

    const sql = query.mock.calls.map(([text]) => String(text));
    expect(sql[0]).toContain('pg_try_advisory_xact_lock');
    expect(query.mock.calls[1][1]).toEqual([7]);
    expect(query.mock.calls[2][1]).toEqual(['2026-09-26', '2026-10-02']);
    expect(where).toHaveBeenCalledWith(
      'stat_date >= :from AND stat_date <= :to',
      { from: '2026-09-26', to: '2026-10-02' },
    );
    expect(insert.mock.calls.map(([, rows]) => rows.length)).toEqual([
      1000, 1000, 500,
    ]);
    expect(insert.mock.calls[0][0]).toBe(MerchantDailyStat);
    expect(insert.mock.calls[0][1][0]).toEqual({
      merchantId: 'merchant-0',
      statDate: '2026-10-01',
      dailyRevenue: '1000',
      dailyOrders: 1,
      dailyProductViews: 2,
    });
  });

  it('skips when another refresh holds the lock', async () => {
    locked = false;

    expect(await service.refreshRecentDays()).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
    expect(where).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('rebuilds every closed day, waiting for the lock', async () => {
    expect(await service.rebuild()).toBe(0);

    expect(String(query.mock.calls[0][0])).toContain(
      'SELECT pg_advisory_xact_lock',
    );
    expect(query.mock.calls[1][1]).toEqual([null]);
    expect(where).toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('reads income per period through the given manager', async () => {
    const own = { query: jest.fn().mockResolvedValue([]) };

    await service.findIncome(
      'merchant-id',
      '2026-09-01',
      '2026-10-31',
      'month',
      own as unknown as EntityManager,
    );

    expect(own.query.mock.calls[0][1]).toEqual([
      'merchant-id',
      '2026-09-01',
      '2026-10-31',
      'month',
    ]);
    const sql = String(own.query.mock.calls[0][0]);
    expect(sql).toContain('LEAST($3::date, ');
    expect(sql).toContain('GREATEST($2::date, ');
    expect(query).not.toHaveBeenCalled();
  });
});

describe('MerchantIncomeJobsService', () => {
  it('logs and survives a failed refresh', async () => {
    const income = {
      refreshRecentDays: jest.fn().mockRejectedValue(new Error('down')),
    };
    const jobs = new MerchantIncomeJobsService(
      income as unknown as MerchantIncomeService,
    );

    await expect(jobs.refreshRecentDays()).resolves.toBeUndefined();
  });

  it('fails startup when the rebuild fails', async () => {
    const income = { rebuild: jest.fn().mockRejectedValue(new Error('down')) };
    const jobs = new MerchantIncomeJobsService(
      income as unknown as MerchantIncomeService,
    );

    await expect(jobs.onApplicationBootstrap()).rejects.toThrow('down');
  });
});
