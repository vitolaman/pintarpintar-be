import { DataSource } from 'typeorm';
import { MerchantProPeriod } from '~/api/pro/entities/merchant-pro-period.entity';
import {
  ProTransaction,
  ProTransactionStatus,
} from '~/api/pro/entities/pro-transaction.entity';
import { GatewayResult, ProPaymentService } from './pro-payment.service';

jest.mock('~/api/email/events/pro-subscription-emails', () => ({
  queueProSubscriptionPaidEmails: jest.fn(),
  queueProSubscriptionFailedEmails: jest.fn(),
}));

const NOW = new Date('2026-11-24T03:00:00.000Z');

const result = (override: Partial<GatewayResult> = {}): GatewayResult => ({
  transactionNumber: 'PRO-20261124-0001',
  resultCode: '00',
  amount: '49000',
  reference: 'DS123',
  paymentMethod: 'BC',
  settlementDate: null,
  ...override,
});

describe('ProPaymentService.applyGatewayResult', () => {
  const manager = {
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    query: jest.fn(),
  };
  const service = new ProPaymentService({
    transaction: (work: (m: typeof manager) => unknown) => work(manager),
  } as unknown as DataSource);
  const transaction = (override: Partial<ProTransaction> = {}) =>
    ({
      id: 'transaction-id',
      merchantId: 'merchant-id',
      planId: 'plan-id',
      planName: 'Pro Bulanan',
      durationMonths: 1,
      transactionNumber: 'PRO-20261124-0001',
      totalAmount: '49000',
      status: ProTransactionStatus.PENDING,
      paymentGatewayRef: 'DS123',
      ...override,
    }) as ProTransaction;

  // Answers the period lookup with the given latest active end.
  const latestActiveEnd = (end: Date | null) =>
    manager.query.mockImplementation(async (sql: string) =>
      sql.includes('max(ends_at)') ? [{ latest_end: end }] : [],
    );
  const savedPeriod = () => {
    const call = manager.save.mock.calls.find(
      ([entity]) => entity === MerchantProPeriod,
    );
    return call?.[1] as MerchantProPeriod;
  };

  beforeAll(() => {
    jest.useFakeTimers({
      now: NOW,
      doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
    });
  });
  afterAll(() => jest.useRealTimers());
  beforeEach(() => jest.clearAllMocks());

  it('starts a renewal paid while Pro is active at the current end', async () => {
    const currentEnd = new Date('2026-12-03T05:00:00.000Z');
    manager.findOne.mockResolvedValueOnce(transaction());
    latestActiveEnd(currentEnd);

    await expect(service.applyGatewayResult(result())).resolves.toBe('paid');

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['pro-period:merchant-id'],
    );
    const lookup = manager.query.mock.calls.find(([sql]) =>
      sql.includes('max(ends_at)'),
    );
    expect(lookup?.[0]).toContain("status = 'active'");
    expect(lookup?.[1]).toEqual(['merchant-id']);
    expect(savedPeriod()).toMatchObject({
      merchantId: 'merchant-id',
      startsAt: currentEnd,
      endsAt: new Date('2027-01-03T05:00:00.000Z'),
      source: 'payment',
      status: 'active',
    });
    expect(manager.update).toHaveBeenCalledWith(
      ProTransaction,
      { id: 'transaction-id' },
      expect.objectContaining({
        status: ProTransactionStatus.PAID,
        paidAt: NOW,
      }),
    );
  });

  it('takes the lock before reading the latest end', async () => {
    manager.findOne.mockResolvedValueOnce(transaction());
    latestActiveEnd(null);

    await service.applyGatewayResult(result());

    const statements = manager.query.mock.calls.map(([sql]) => sql as string);
    const lock = statements.findIndex((sql) =>
      sql.includes('pg_advisory_xact_lock'),
    );
    const lookup = statements.findIndex((sql) => sql.includes('max(ends_at)'));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(lookup);
  });

  it('starts at the payment time when the last period has ended', async () => {
    manager.findOne.mockResolvedValueOnce(transaction());
    latestActiveEnd(new Date('2026-11-01T05:00:00.000Z'));

    await expect(service.applyGatewayResult(result())).resolves.toBe('paid');

    expect(savedPeriod()).toMatchObject({
      startsAt: NOW,
      endsAt: new Date('2026-12-24T03:00:00.000Z'),
    });
  });

  it('starts at the payment time when the merchant had no period', async () => {
    manager.findOne.mockResolvedValueOnce(
      transaction({ durationMonths: 12, totalAmount: '490000' }),
    );
    latestActiveEnd(null);

    await service.applyGatewayResult(result({ amount: '490000' }));

    expect(savedPeriod()).toMatchObject({
      startsAt: NOW,
      endsAt: new Date('2027-11-24T03:00:00.000Z'),
    });
  });

  it('adds no period for a repeated notification of a paid transaction', async () => {
    manager.findOne.mockResolvedValueOnce(
      transaction({ status: ProTransactionStatus.PAID }),
    );

    await expect(service.applyGatewayResult(result())).resolves.toBe(
      'unchanged',
    );

    expect(manager.save).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.query).not.toHaveBeenCalled();
  });
});
