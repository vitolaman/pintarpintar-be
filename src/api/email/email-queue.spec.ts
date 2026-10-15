import { EntityManager } from 'typeorm';
import {
  DEFAULT_EMAIL_LIFETIME_MS,
  guardEmailQueue,
  queueEmails,
} from './email-queue';

function transactionManager() {
  return {
    queryRunner: { isTransactionActive: true },
    query: jest.fn(),
    transaction: jest.fn(),
  } as unknown as EntityManager & { query: jest.Mock; transaction: jest.Mock };
}

describe('guardEmailQueue', () => {
  it('runs under a savepoint inside a transaction', async () => {
    const manager = transactionManager();
    const queue = jest.fn();

    await guardEmailQueue(manager, 'test', queue);

    expect(queue).toHaveBeenCalledWith(manager);
    expect(manager.query.mock.calls).toEqual([
      ['SAVEPOINT email_queue'],
      ['RELEASE SAVEPOINT email_queue'],
    ]);
  });

  it('rolls back to the savepoint and never throws when queuing fails', async () => {
    const manager = transactionManager();

    await expect(
      guardEmailQueue(manager, 'test', async () => {
        throw new Error('column does not exist');
      }),
    ).resolves.toBeUndefined();

    expect(manager.query.mock.calls).toEqual([
      ['SAVEPOINT email_queue'],
      ['ROLLBACK TO SAVEPOINT email_queue'],
    ]);
  });

  it('opens its own transaction outside one', async () => {
    const manager = {
      transaction: jest.fn().mockRejectedValue(new Error('down')),
    } as unknown as EntityManager & { transaction: jest.Mock };
    const queue = jest.fn();

    await expect(
      guardEmailQueue(manager, 'test', queue),
    ).resolves.toBeUndefined();
    expect(manager.transaction).toHaveBeenCalledWith(queue);
  });
});

describe('queueEmails', () => {
  function insertManager() {
    const execute = jest.fn();
    const builder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute,
    };
    const manager = {
      createQueryBuilder: jest.fn(() => builder),
      query: jest.fn().mockResolvedValue([]),
    } as unknown as EntityManager;
    return { manager, builder };
  }

  const email = (index: number, to = `learner${index}@example.test`) => ({
    kind: 'password_changed' as const,
    to,
    dedupeKey: `key:${index}`,
    payload: { user_name: 'A', email: to, changed_at: '2026-10-05T00:00:00Z' },
  });

  it('skips duplicates by key and gives a three-day expiry by default', async () => {
    const { manager, builder } = insertManager();
    const before = Date.now();

    await queueEmails(manager, [email(1)]);

    expect(builder.orIgnore).toHaveBeenCalled();
    const [[rows]] = builder.values.mock.calls;
    expect(rows[0]).toMatchObject({
      kind: 'password_changed',
      recipientEmail: 'learner1@example.test',
      dedupeKey: 'key:1',
    });
    expect(rows[0].expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + DEFAULT_EMAIL_LIFETIME_MS,
    );
  });

  it('skips emails without a recipient and inserts in batches of 500', async () => {
    const { manager, builder } = insertManager();

    await queueEmails(manager, [
      ...Array.from({ length: 1001 }, (_, index) => email(index)),
      email(9999, '  '),
    ]);

    expect(builder.values.mock.calls.map(([rows]) => rows.length)).toEqual([
      500, 500, 1,
    ]);
  });

  it('suppresses disabled mapped emails without changing mandatory ones', async () => {
    const { manager, builder } = insertManager();
    (manager.query as jest.Mock).mockResolvedValue([
      { user_id: 'account-1', email_application_submitted: false },
    ]);
    await queueEmails(manager, [
      {
        kind: 'application_submitted',
        to: 'contact@example.test',
        userId: 'account-1',
        dedupeKey: 'application:1',
        payload: {
          applicant_name: 'A',
          job_title: 'Mentor',
          store_name: 'Store',
        },
      },
      email(1),
    ]);
    expect(builder.values.mock.calls[0][0]).toEqual([
      expect.objectContaining({ kind: 'password_changed', status: 'pending' }),
    ]);
  });

  it('records a terminal suppressed outcome when required by a polling detector', async () => {
    const { manager, builder } = insertManager();
    (manager.query as jest.Mock).mockResolvedValue([
      { user_id: 'account-1', email_cashflow_success: false },
    ]);
    await queueEmails(
      manager,
      [
        {
          kind: 'withdrawal_succeeded',
          to: 'owner@example.test',
          userId: 'account-1',
          dedupeKey: 'payout:1:success',
          payload: {
            owner_name: 'A',
            store_name: 'Store',
            amount: 100000,
            fee_amount: 5000,
            destination: 'Bank •••• 0001',
            requested_at: new Date().toISOString(),
          },
        },
      ],
      { recordSuppressed: true },
    );
    expect(builder.values.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        dedupeKey: 'payout:1:success',
        status: 'discarded',
      }),
    ]);
    expect(builder.orIgnore).toHaveBeenCalled();
  });
});
