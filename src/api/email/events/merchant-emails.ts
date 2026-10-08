import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { EmailToQueue, guardEmailQueue, queueEmails } from '../email-queue';
import type { MerchantLevel, PayoutAccountAction } from '../templates/payloads';

interface MerchantOwner {
  store_name: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
}

async function findOwner(
  manager: EntityManager,
  merchantId: string,
): Promise<MerchantOwner | null> {
  const [owner]: MerchantOwner[] = await manager.query(
    `SELECT merchant.store_name, owner.id AS owner_id, owner.name AS owner_name,
            owner.email AS owner_email
     FROM merchants merchant
     INNER JOIN users owner ON owner.id = merchant.user_id AND owner.deleted_at IS NULL
     WHERE merchant.id = $1`,
    [merchantId],
  );
  return owner ?? null;
}

// Periods are first-of-month dates (YYYY-MM-01).
const monthOf = (period: string) => period.slice(0, 7);
function shiftMonth(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  return shifted.toISOString().slice(0, 7);
}

export interface EvaluationEmailFacts {
  evaluationId: string;
  merchantId: string;
  period: string;
  revenue: number;
  levelBefore: MerchantLevel;
  levelAfter: MerchantLevel;
  action: 'none' | 'warning' | 'removed';
  removedItems: number;
}

/** The monthly result, plus the warning or removal notice when there is one. */
export async function queueLevelEvaluationEmails(
  manager: EntityManager,
  facts: EvaluationEmailFacts,
): Promise<void> {
  await guardEmailQueue(manager, 'level evaluation', async (manager) => {
    const owner = await findOwner(manager, facts.merchantId);
    if (!owner) return;
    const recipient = { to: owner.owner_email, userId: owner.owner_id };
    const names = {
      owner_name: owner.owner_name,
      store_name: owner.store_name,
    };
    const key = `level-evaluation:${facts.evaluationId}`;
    const emails: EmailToQueue[] = [
      {
        kind: 'merchant_level_result',
        ...recipient,
        dedupeKey: `${key}:result`,
        payload: {
          ...names,
          month: monthOf(facts.period),
          revenue: facts.revenue,
          level_before: facts.levelBefore,
          level_after: facts.levelAfter,
        },
      },
    ];
    if (facts.action === 'warning') {
      emails.push({
        kind: 'merchant_inactivity_warning',
        ...recipient,
        dedupeKey: `${key}:warning`,
        payload: {
          ...names,
          quiet_months: [shiftMonth(facts.period, -1), monthOf(facts.period)],
          deadline_month: shiftMonth(facts.period, 1),
        },
      });
    }
    if (facts.action === 'removed') {
      emails.push({
        kind: 'merchant_items_removed',
        ...recipient,
        dedupeKey: `${key}:removed`,
        payload: { ...names, removed_count: facts.removedItems },
      });
    }
    await queueEmails(manager, emails);
  });
}

export interface WithdrawalEmailFacts {
  payoutId: string;
  merchantId: string;
  amount: number;
  feeAmount: number;
  bankName: string;
  maskedAccountNumber: string;
  accountHolderName: string;
  requestedAt: Date;
}

export async function queueWithdrawalRequestedEmail(
  manager: EntityManager,
  facts: WithdrawalEmailFacts,
): Promise<void> {
  await guardEmailQueue(manager, 'withdrawal requested', async (manager) => {
    const owner = await findOwner(manager, facts.merchantId);
    if (!owner) return;
    await queueEmails(manager, [
      {
        kind: 'withdrawal_requested',
        to: owner.owner_email,
        userId: owner.owner_id,
        dedupeKey: `payout:${facts.payoutId}:requested`,
        payload: {
          owner_name: owner.owner_name,
          store_name: owner.store_name,
          amount: facts.amount,
          fee_amount: facts.feeAmount,
          bank_name: facts.bankName,
          masked_account_number: facts.maskedAccountNumber,
          account_holder_name: facts.accountHolderName,
          requested_at: facts.requestedAt.toISOString(),
        },
      },
    ]);
  });
}

export interface PayoutAccountEmailFacts {
  merchantId: string;
  action: PayoutAccountAction;
  bankName: string;
  maskedAccountNumber: string;
  accountHolderName: string;
}

/** A security notice; every change is its own event, so keys never repeat. */
export async function queuePayoutAccountChangedEmail(
  manager: EntityManager,
  facts: PayoutAccountEmailFacts,
): Promise<void> {
  await guardEmailQueue(manager, 'payout account change', async (manager) => {
    const owner = await findOwner(manager, facts.merchantId);
    if (!owner) return;
    await queueEmails(manager, [
      {
        kind: 'payout_account_changed',
        to: owner.owner_email,
        userId: owner.owner_id,
        dedupeKey: `payout-account:${facts.action}:${randomUUID()}`,
        payload: {
          owner_name: owner.owner_name,
          store_name: owner.store_name,
          action: facts.action,
          bank_name: facts.bankName,
          masked_account_number: facts.maskedAccountNumber,
          account_holder_name: facts.accountHolderName,
          changed_at: new Date().toISOString(),
        },
      },
    ]);
  });
}

/**
 * One "Saldo siap ditarik" email per merchant credited by a settlement run,
 * queued in the run's transaction. `amounts` are the net amounts the run
 * credits; the key names the run by its first order, so each run is its own
 * event.
 */
export async function queueBalanceSettledEmails(
  manager: EntityManager,
  orderIds: string[],
  amounts: Array<{ merchantId: string; amount: string | number }>,
): Promise<void> {
  const credited = amounts.filter((credit) => Number(credit.amount) > 0);
  if (orderIds.length === 0 || credited.length === 0) return;
  await guardEmailQueue(manager, 'balance settled', async (manager) => {
    const counts: Array<{ merchant_id: string; order_count: number }> =
      await manager.query(
        `SELECT COALESCE(class.merchant_id, product.merchant_id, bundle.merchant_id) AS merchant_id,
                count(DISTINCT item.order_id)::integer AS order_count
         FROM order_items item
         LEFT JOIN classes class ON class.id = item.class_id
         LEFT JOIN products product ON product.id = item.product_id
         LEFT JOIN bundles bundle ON bundle.id = item.bundle_id
         WHERE item.order_id = ANY($1::uuid[]) AND item.deleted_at IS NULL
         GROUP BY 1`,
        [orderIds],
      );
    const settledAt = new Date().toISOString();
    const emails: EmailToQueue[] = [];
    for (const credit of credited) {
      const owner = await findOwner(manager, credit.merchantId);
      if (!owner) continue;
      emails.push({
        kind: 'merchant_balance_settled',
        to: owner.owner_email,
        userId: owner.owner_id,
        dedupeKey: `settlement:${credit.merchantId}:${orderIds[0]}`,
        payload: {
          owner_name: owner.owner_name,
          store_name: owner.store_name,
          amount: Number(credit.amount),
          order_count:
            counts.find((row) => row.merchant_id === credit.merchantId)
              ?.order_count ?? 0,
          settled_at: settledAt,
        },
      });
    }
    await queueEmails(manager, emails);
  });
}

// Withdrawal outcome emails start with the withdrawals requested once
// transactional email went live; earlier withdrawals are never emailed.
export const WITHDRAWAL_OUTCOME_EMAILS_FROM = '2026-10-05';
// Well inside the 90-day outbox retention, so a purged email is never re-sent.
const WITHDRAWAL_OUTCOME_WINDOW_DAYS = 60;
const WITHDRAWAL_OUTCOME_BATCH_SIZE = 200;

interface CompletedWithdrawalRow {
  id: string;
  merchant_id: string;
  status: 'success' | 'failed';
  amount: string;
  fee_amount: string;
  destination_bank_account: string;
  requested_at: Date;
}

/**
 * Withdrawals are completed by hand outside the API, so their outcome is
 * found by polling: each withdrawal marked `success` or `failed` without its
 * outcome email gets one. Returns how many emails were queued.
 */
export async function queueWithdrawalOutcomeEmails(
  manager: EntityManager,
): Promise<number> {
  const rows: CompletedWithdrawalRow[] = await manager.query(
    `SELECT payout.id, payout.merchant_id, payout.status, payout.amount,
            payout.fee_amount, payout.destination_bank_account,
            payout.requested_at AT TIME ZONE 'UTC' AS requested_at
     FROM merchant_payouts payout
     WHERE payout.status IN ('success', 'failed') AND payout.deleted_at IS NULL
       AND payout.requested_at >= $1::date
       AND payout.requested_at > (now() AT TIME ZONE 'UTC') - make_interval(days => $2)
       AND NOT EXISTS (
         SELECT 1 FROM email_outbox email
         WHERE email.dedupe_key = 'payout:' || payout.id || ':' || payout.status
       )
     ORDER BY payout.requested_at, payout.id
     LIMIT ${WITHDRAWAL_OUTCOME_BATCH_SIZE}`,
    [WITHDRAWAL_OUTCOME_EMAILS_FROM, WITHDRAWAL_OUTCOME_WINDOW_DAYS],
  );
  const emails: EmailToQueue[] = [];
  for (const row of rows) {
    const owner = await findOwner(manager, row.merchant_id);
    if (!owner) continue;
    emails.push({
      kind:
        row.status === 'success' ? 'withdrawal_succeeded' : 'withdrawal_failed',
      to: owner.owner_email,
      userId: owner.owner_id,
      dedupeKey: `payout:${row.id}:${row.status}`,
      payload: {
        owner_name: owner.owner_name,
        store_name: owner.store_name,
        amount: Number(row.amount),
        fee_amount: Number(row.fee_amount),
        destination: row.destination_bank_account,
        requested_at: new Date(row.requested_at).toISOString(),
      },
    });
  }
  await queueEmails(manager, emails);
  return emails.length;
}
