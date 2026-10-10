import { EntityManager } from 'typeorm';
import { EmailToQueue, guardEmailQueue, queueEmails } from '../email-queue';
import { PRO_GRACE_DAYS } from '../../pro/pro-status';

interface ProEndRow {
  merchant_id: string;
  store_name: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  // Asia/Jakarta date of the end of the store's last active period.
  end_date: string;
  final_date: string;
  // end_date minus today, in days.
  days_left: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS_BEFORE = 7;

/**
 * The Pro expiry emails due today (Asia/Jakarta) for stores whose Pro time
 * ends without a later period: 7 days before the end, the end date and the
 * 6 days after it, and the date the grace ends. A renewal moves the end, so
 * no later email for the old end is due. Returns how many were queued.
 */
export async function queueProExpiryEmails(
  manager: EntityManager,
  now = new Date(),
): Promise<number> {
  let queued = 0;
  await guardEmailQueue(manager, 'Pro expiry', async (manager) => {
    const rows: ProEndRow[] = await manager.query(
      `WITH ends AS (
         SELECT merchant.id AS merchant_id, merchant.store_name,
                owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email,
                (max(period.ends_at) AT TIME ZONE 'Asia/Jakarta')::date AS end_day
         FROM merchant_pro_periods period
         INNER JOIN merchants merchant
           ON merchant.id = period.merchant_id AND merchant.deleted_at IS NULL
          AND merchant.status = 'active'
         INNER JOIN users owner ON owner.id = merchant.user_id AND owner.deleted_at IS NULL
         WHERE period.status = 'active' AND period.deleted_at IS NULL
         GROUP BY merchant.id, owner.id
       )
       SELECT merchant_id, store_name, owner_id, owner_name, owner_email,
              end_day::text AS end_date,
              (end_day + $2::integer)::text AS final_date,
              (end_day - ($1::timestamptz AT TIME ZONE 'Asia/Jakarta')::date) AS days_left
       FROM ends
       WHERE end_day - ($1::timestamptz AT TIME ZONE 'Asia/Jakarta')::date
             BETWEEN -$2::integer AND $3::integer`,
      [now.toISOString(), PRO_GRACE_DAYS, REMINDER_DAYS_BEFORE],
    );
    const emails: EmailToQueue[] = [];
    for (const row of rows) {
      const email = proExpiryEmail(row);
      if (!email) continue;
      emails.push({
        ...email,
        to: row.owner_email,
        userId: row.owner_id,
        dedupeKey: `pro-expiry:${row.merchant_id}:${row.end_date}:${row.days_left}`,
        // A daily notice is stale the next day.
        expiresAt: new Date(now.getTime() + DAY_MS),
      } as EmailToQueue);
    }
    // Emails already queued on an earlier run today are skipped, so the
    // count is what this run added.
    const existing: Array<{ dedupe_key: string }> = await manager.query(
      'SELECT dedupe_key FROM email_outbox WHERE dedupe_key = ANY($1::text[])',
      [emails.map((email) => email.dedupeKey)],
    );
    const known = new Set(existing.map((row) => row.dedupe_key));
    const fresh = emails.filter((email) => !known.has(email.dedupeKey));
    await queueEmails(manager, fresh);
    queued = fresh.length;
  });
  return queued;
}

function proExpiryEmail(
  row: ProEndRow,
): Pick<EmailToQueue, 'kind' | 'payload'> | null {
  const names = { owner_name: row.owner_name, store_name: row.store_name };
  const daysLeft = Number(row.days_left);
  if (daysLeft === REMINDER_DAYS_BEFORE) {
    return {
      kind: 'pro_expiring',
      payload: { ...names, end_date: row.end_date },
    };
  }
  if (daysLeft <= 0 && daysLeft > -PRO_GRACE_DAYS) {
    return {
      kind: 'pro_not_renewed',
      payload: { ...names, end_date: row.final_date },
    };
  }
  if (daysLeft === -PRO_GRACE_DAYS) {
    return {
      kind: 'pro_ended',
      payload: { ...names, end_date: row.final_date },
    };
  }
  return null;
}
