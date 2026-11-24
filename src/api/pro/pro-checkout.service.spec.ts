import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DuitkuClient } from '~/api/payment/duitku/duitku.client';
import { ProPaymentService } from '~/api/payment/pro-payment.service';
import { Merchant } from '~/api/merchant/entities/merchant.entity';
import { ProPlan } from './entities/pro-plan.entity';
import {
  ProTransaction,
  ProTransactionStatus,
} from './entities/pro-transaction.entity';
import {
  PRO_PAYMENT_WAITING,
  ProCheckoutService,
} from './pro-checkout.service';

jest.mock('~/api/email/events/pro-subscription-emails', () => ({
  queueProSubscriptionAwaitingPaymentEmail: jest.fn(),
}));

describe('ProCheckoutService.checkout', () => {
  const pendingTransaction = {
    id: 'transaction-id',
    transactionNumber: 'PRO-20261124-0001',
    planName: 'Pro Bulanan',
    durationMonths: 1,
    totalAmount: '49000',
    discountAmount: '0',
    status: ProTransactionStatus.PENDING,
  } as ProTransaction;
  const manager = {
    findOneByOrFail: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
  };
  const createInvoice = jest.fn();
  const failTransaction = jest.fn();
  const service = new ProCheckoutService(
    {
      manager,
      transaction: (work: (m: typeof manager) => unknown) => work(manager),
    } as unknown as DataSource,
    { createInvoice } as unknown as DuitkuClient,
    { failTransaction } as unknown as ProPaymentService,
  );

  // Answers the waiting-payment check with the given rows.
  const waitingPayments = (rows: Array<{ id: string }>) =>
    manager.query.mockImplementation(async (sql: string) => {
      if (sql.includes("status = 'pending'")) return rows;
      if (sql.includes('Asia/Jakarta')) return [{ date: '2026-11-24' }];
      if (sql.includes('max(substring')) return [{ last: null }];
      return [];
    });
  const waitingCheck = () =>
    manager.query.mock.calls.find(([sql]) =>
      sql.includes("status = 'pending'"),
    );

  beforeEach(() => {
    jest.clearAllMocks();
    manager.findOneByOrFail.mockResolvedValue({
      id: 'user-id',
      email: 'merchant@example.test',
      name: 'Merchant',
    });
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === Merchant) return { id: 'merchant-id' };
      if (entity === ProPlan) {
        return {
          id: 'plan-id',
          name: 'Pro Bulanan',
          durationMonths: 1,
          price: '49000',
        };
      }
      return pendingTransaction;
    });
    manager.save.mockResolvedValue(pendingTransaction);
    createInvoice.mockResolvedValue({
      reference: 'DS123',
      paymentUrl: 'https://app-sandbox.duitku.com/redirect_checkout',
    });
  });

  it('refuses a second checkout while a payment is still waiting', async () => {
    waitingPayments([{ id: 'waiting-id' }]);

    await expect(service.checkout('user-id', 'plan-id')).rejects.toThrow(
      new ConflictException(PRO_PAYMENT_WAITING),
    );

    expect(manager.save).not.toHaveBeenCalled();
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it('checks only unexpired pending payments of this merchant under its lock', async () => {
    waitingPayments([]);

    await service.checkout('user-id', 'plan-id');

    expect(manager.query.mock.calls[0]).toEqual([
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['pro-checkout:merchant-id'],
    ]);
    const [sql, params] = waitingCheck()!;
    expect(sql).toContain('merchant_id = $1');
    expect(sql).toContain('expires_at > now()');
    expect(sql).toContain('deleted_at IS NULL');
    expect(params).toEqual(['merchant-id']);
  });

  it('creates the transaction and a Pro invoice when nothing is waiting', async () => {
    waitingPayments([]);

    const response = await service.checkout('user-id', 'plan-id');

    expect(manager.save).toHaveBeenCalledWith(
      ProTransaction,
      expect.objectContaining({
        merchantId: 'merchant-id',
        status: ProTransactionStatus.PENDING,
        transactionNumber: 'PRO-20261124-0001',
      }),
    );
    expect(response.data.transaction_id).toBe('transaction-id');
  });

  it('returns a Pro invoice to the Pro receipt without an order id', async () => {
    waitingPayments([]);

    await service.checkout('user-id', 'plan-id');

    expect(createInvoice).toHaveBeenCalledTimes(1);
    const [request] = createInvoice.mock.calls[0];
    expect(request.returnParams).toEqual({
      type: 'pro',
      subscription_id: 'transaction-id',
    });
    expect(request).not.toHaveProperty('orderId');
    expect(request.orderNumber).toBe('PRO-20261124-0001');
  });
});
