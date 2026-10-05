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
