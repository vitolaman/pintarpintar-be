import { EntityManager } from 'typeorm';
import {
  queueBalanceSettledEmails,
  queueWithdrawalOutcomeEmails,
} from './merchant-emails';
import { queueApplicationEmail } from './recruitment-emails';

const owner = (merchantId: string) => ({
  store_name: `Toko ${merchantId}`,
  owner_id: `owner-${merchantId}`,
  owner_name: `Pemilik ${merchantId}`,
  owner_email: `${merchantId}@example.test`,
});

// A manager inside a transaction whose queries are answered by `answer` and
// whose outbox inserts are captured in `queued`.
function manager(answer: (sql: string, params?: unknown[]) => unknown[]) {
  const queued: Array<Record<string, unknown>> = [];
  const builder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn((rows: Array<Record<string, unknown>>) => {
      queued.push(...rows);
      return builder;
    }),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const query = jest.fn(async (sql: string, params?: unknown[]) =>
    sql.includes('SAVEPOINT') ? [] : answer(sql, params),
  );
  return {
    queued,
    query,
    manager: {
      queryRunner: { isTransactionActive: true },
      query,
      createQueryBuilder: jest.fn(() => builder),
    } as unknown as EntityManager,
  };
}

describe('queueBalanceSettledEmails', () => {
  const answer = (sql: string, params?: unknown[]) => {
    if (sql.includes('count(DISTINCT item.order_id)')) {
      return [
        { merchant_id: 'm1', order_count: 2 },
        { merchant_id: 'm2', order_count: 1 },
      ];
    }
    if (sql.includes('FROM merchants merchant')) {
      return [owner(String(params?.[0]))];
    }
    return [];
  };

  it('queues one email per credited merchant with its amount and orders', async () => {
    const { manager: em, queued } = manager(answer);

    await queueBalanceSettledEmails(
      em,
      ['o1', 'o2', 'o3'],
      [
        { merchantId: 'm1', amount: '200000' },
        { merchantId: 'm2', amount: '50000' },
        { merchantId: 'm3', amount: '0' },
      ],
    );

    expect(queued).toEqual([
      expect.objectContaining({
        kind: 'merchant_balance_settled',
        recipientEmail: 'm1@example.test',
        dedupeKey: 'settlement:m1:o1',
        payload: expect.objectContaining({ amount: 200000, order_count: 2 }),
      }),
      expect.objectContaining({
        recipientEmail: 'm2@example.test',
        dedupeKey: 'settlement:m2:o1',
        payload: expect.objectContaining({ amount: 50000, order_count: 1 }),
      }),
    ]);
  });

  it('queues nothing when no order was settled', async () => {
    const { manager: em, query } = manager(answer);

    await queueBalanceSettledEmails(em, [], []);

    expect(query).not.toHaveBeenCalled();
  });
});

describe('queueWithdrawalOutcomeEmails', () => {
  it('names the kind and key after the outcome, from the cut-off date', async () => {
    const {
      manager: em,
      queued,
      query,
    } = manager((sql, params) => {
      if (sql.includes('FROM merchant_payouts')) {
        return [
          {
            id: 'p1',
            merchant_id: 'm1',
            status: 'success',
            amount: '500000',
            fee_amount: '5000',
            destination_bank_account: 'BCA •••• 7890 a.n. Sari',
            requested_at: new Date('2026-10-09T03:00:00Z'),
          },
          {
            id: 'p2',
            merchant_id: 'm1',
            status: 'failed',
            amount: '100000',
            fee_amount: '5000',
            destination_bank_account: 'BCA •••• 7890 a.n. Sari',
            requested_at: new Date('2026-10-09T04:00:00Z'),
          },
        ];
      }
      return [owner(String(params?.[0]))];
    });

    await expect(queueWithdrawalOutcomeEmails(em)).resolves.toBe(2);

    const [, params] = query.mock.calls.find(([sql]) =>
      sql.includes('FROM merchant_payouts'),
    ) as [string, unknown[]];
    expect(params).toEqual(['2026-10-05', 60]);
    expect(queued.map((row) => [row.kind, row.dedupeKey])).toEqual([
      ['withdrawal_succeeded', 'payout:p1:success'],
      ['withdrawal_failed', 'payout:p2:failed'],
    ]);
    expect(queued[0].payload).toMatchObject({
      amount: 500000,
      fee_amount: 5000,
      destination: 'BCA •••• 7890 a.n. Sari',
      requested_at: '2026-10-09T03:00:00.000Z',
    });
  });
});

describe('queueApplicationEmail on a new application', () => {
  const application = (
    emailNewApplicant: boolean,
    ownerEmail = 'o@x.test',
  ) => ({
    id: 'a1',
    applicant_user_id: 'u1',
    applicant_name: 'Fajar',
    applicant_email: 'fajar@example.test',
    job_title: 'Mentor AutoCAD',
    store_name: 'Studio Sipil',
    class_title: null,
    applied_at: new Date('2026-10-08T02:15:00Z'),
    owner_id: 'owner-1',
    owner_name: 'Bambang',
    owner_email: ownerEmail,
    email_new_applicant: emailNewApplicant,
  });

  it('emails the applicant and the merchant owner', async () => {
    const { manager: em, queued } = manager(() => [application(true)]);

    await queueApplicationEmail(em, 'a1', { type: 'submitted' });

    expect(queued.map((row) => [row.kind, row.recipientEmail])).toEqual([
      ['application_submitted', 'fajar@example.test'],
      ['merchant_new_applicant', 'o@x.test'],
    ]);
    expect(queued[1]).toMatchObject({
      dedupeKey: 'application:a1:merchant',
      payload: {
        owner_name: 'Bambang',
        store_name: 'Studio Sipil',
        applicant_name: 'Fajar',
        job_title: 'Mentor AutoCAD',
        applied_at: '2026-10-08T02:15:00.000Z',
      },
    });
  });

  it('emails only the applicant when the owner turned applicant emails off', async () => {
    const { manager: em, queued } = manager(() => [application(false)]);

    await queueApplicationEmail(em, 'a1', { type: 'submitted' });

    expect(queued.map((row) => row.kind)).toEqual(['application_submitted']);
  });

  it('does not email the merchant on later application events', async () => {
    const { manager: em, queued } = manager(() => [application(true)]);

    await queueApplicationEmail(em, 'a1', { type: 'accepted' });

    expect(queued.map((row) => row.kind)).toEqual(['application_accepted']);
  });
});
