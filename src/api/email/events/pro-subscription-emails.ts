import { EntityManager } from 'typeorm';
import { guardEmailQueue, queueEmails } from '../email-queue';

// Payment emails for a Pro purchase, deduplicated by transaction and kind.
// The common queue policy makes only the success confirmation optional.

interface ProTransactionRow {
  id: string;
  user_id: string;
  merchant_id: string;
  plan_id: string;
  transaction_number: string;
  plan_name: string | null;
  duration_months: number | null;
  total_amount: string;
  payment_url: string | null;
  payment_method: string | null;
  expires_at: Date | null;
  paid_at: Date | null;
  owner_name: string;
  owner_email: string;
}

// Timestamps are stored as UTC without a zone.
async function loadTransaction(
  manager: EntityManager,
  transactionId: string,
): Promise<ProTransactionRow | null> {
  const [row]: ProTransactionRow[] = await manager.query(
    `SELECT pro.id, pro.user_id, pro.merchant_id, pro.plan_id, pro.transaction_number,
            pro.plan_name, pro.duration_months, pro.total_amount, pro.payment_url,
            pro.payment_method,
            pro.expires_at AT TIME ZONE 'UTC' AS expires_at,
            pro.paid_at AT TIME ZONE 'UTC' AS paid_at,
            owner.name AS owner_name, owner.email AS owner_email
     FROM pro_transactions pro
     INNER JOIN users owner ON owner.id = pro.user_id AND owner.deleted_at IS NULL
     WHERE pro.id = $1 AND pro.deleted_at IS NULL`,
    [transactionId],
  );
  return row ?? null;
}

function summary(row: ProTransactionRow) {
  return {
    transaction_number: row.transaction_number,
    owner_name: row.owner_name,
    plan_name: row.plan_name ?? 'Pro',
    duration_months: row.duration_months ?? 1,
    total_amount: Number(row.total_amount),
  };
}

/** Called once the transaction's Duitku invoice exists. */
export async function queueProSubscriptionAwaitingPaymentEmail(
  manager: EntityManager,
  transactionId: string,
): Promise<void> {
  await guardEmailQueue(manager, 'pro awaiting payment', async (manager) => {
    const row = await loadTransaction(manager, transactionId);
    if (!row?.payment_url || !row.expires_at) return;
    await queueEmails(manager, [
      {
        kind: 'pro_awaiting_payment',
        to: row.owner_email,
        userId: row.user_id,
        dedupeKey: `pro:${row.id}:awaiting`,
        payload: {
          ...summary(row),
          expires_at: new Date(row.expires_at).toISOString(),
          payment_url: row.payment_url,
        },
        expiresAt: new Date(row.expires_at),
      },
    ]);
  });
}

/**
 * Called in the payment transaction after the Pro period is created; the end
 * date is that period's, as an Asia/Jakarta date.
 */
export async function queueProSubscriptionPaidEmails(
  manager: EntityManager,
  transactionId: string,
): Promise<void> {
  await guardEmailQueue(manager, 'pro paid', async (manager) => {
    const row = await loadTransaction(manager, transactionId);
    if (!row?.paid_at) return;
    const [period]: Array<{ pro_until: string }> = await manager.query(
      `SELECT (ends_at AT TIME ZONE 'Asia/Jakarta')::date::text AS pro_until
       FROM merchant_pro_periods
       WHERE merchant_id = $1 AND plan_id = $2 AND source = 'payment' AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [row.merchant_id, row.plan_id],
    );
    if (!period) return;
    await queueEmails(manager, [
      {
        kind: 'pro_paid',
        to: row.owner_email,
        userId: row.user_id,
        dedupeKey: `pro:${row.id}:paid`,
        payload: {
          ...summary(row),
          paid_at: new Date(row.paid_at).toISOString(),
          payment_method: row.payment_method,
          pro_until: period.pro_until,
        },
      },
    ]);
  });
}

/** Called when Duitku reports a failure for a pending transaction. */
export async function queueProSubscriptionFailedEmails(
  manager: EntityManager,
  transactionId: string,
): Promise<void> {
  await guardEmailQueue(manager, 'pro failed', async (manager) => {
    const row = await loadTransaction(manager, transactionId);
    if (!row) return;
    await queueEmails(manager, [
      {
        kind: 'pro_failed',
        to: row.owner_email,
        userId: row.user_id,
        dedupeKey: `pro:${row.id}:failed`,
        payload: summary(row),
      },
    ]);
  });
}
