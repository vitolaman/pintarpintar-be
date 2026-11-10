import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { DailyTransactionQueryDto } from './dto/transaction-analytics.dto';
import { TransactionAnalyticsService } from './transaction-analytics.service';

describe('TransactionAnalyticsService', () => {
  it('returns daily and monthly totals without losing decimal precision', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        date: '2026-11-01',
        total_transactions: 2,
        total_nominal: '100.25',
        month_transactions: 2,
        month_nominal: '100.25',
      },
      {
        date: '2026-11-02',
        total_transactions: 0,
        total_nominal: '0',
        month_transactions: 2,
        month_nominal: '100.25',
      },
    ]);
    const service = new TransactionAnalyticsService({
      query,
    } as unknown as DataSource);
    const result = await service.findDaily('2026-11');
    expect(result.data).toEqual({
      month: '2026-11',
      timezone: 'Asia/Jakarta',
      total_transactions: 2,
      total_nominal: '100.25',
      days: [
        { date: '2026-11-01', total_transactions: 2, total_nominal: '100.25' },
        { date: '2026-11-02', total_transactions: 0, total_nominal: '0' },
      ],
    });
    const [sql, params] = query.mock.calls[0];
    expect(params).toEqual(['2026-11']);
    expect(sql).toContain('FROM orders, bounds');
    expect(sql).toContain('FROM pro_transactions, bounds');
    expect(sql).toContain("status = 'paid'");
    expect(sql).toContain('COALESCE(paid_at, created_at)');
    expect(sql).toContain('generate_series');
  });
});

describe('DailyTransactionQueryDto', () => {
  it.each(['0000-01', '2026-00', '2026-13', '2026-1', 'abc'])(
    'rejects %s',
    async (month) => {
      expect(
        await validate(plainToInstance(DailyTransactionQueryDto, { month })),
      ).not.toEqual([]);
    },
  );
  it('accepts a valid month and treats a blank as omitted', async () => {
    for (const month of ['2026-11', '   ']) {
      expect(
        await validate(plainToInstance(DailyTransactionQueryDto, { month })),
      ).toEqual([]);
    }
  });
});
