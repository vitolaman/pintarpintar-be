import { EntityManager } from 'typeorm';
import {
  jakartaDayStartUtc,
  paidSalesBetweenSql,
} from '~/api/merchant-dashboard/merchant-sales-sql';
import { EmailToQueue, guardEmailQueue, queueEmails } from '../email-queue';
import type { ItemType } from '../templates/layout';

interface WeeklyRow {
  merchant_id: string;
  store_name: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  revenue: string;
  previous_revenue: string;
  transactions: number;
  buyers: number;
  top_items: Array<{
    title: string;
    type: ItemType;
    amount: string | number;
    sold: number;
  }>;
  new_reviews: number;
  average_rating: string | null;
  withdrawable_balance: string;
}

// $1 is the reported week's Monday (Asia/Jakarta). Sales of that week and
// the week before come from the dashboard's paid-sales rows, so the figures
// match it; stores without a sale or a new review that week are left out.
const WEEKLY_REPORT_SQL = `
  WITH sales AS (
    SELECT sale.*, sale.sold_at >= ${jakartaDayStartUtc('$1::date')} AS this_week
    FROM (${paidSalesBetweenSql('all', jakartaDayStartUtc('$1::date - 7'), jakartaDayStartUtc('$1::date + 7'))}) sale
  ), totals AS (
    SELECT merchant_id,
           COALESCE(sum(amount) FILTER (WHERE this_week), 0) AS revenue,
           COALESCE(sum(amount) FILTER (WHERE NOT this_week), 0) AS previous_revenue,
           (count(DISTINCT order_id) FILTER (WHERE this_week))::integer AS transactions,
           (count(DISTINCT user_id) FILTER (WHERE this_week))::integer AS buyers
    FROM sales GROUP BY merchant_id
  ), ranked AS (
    SELECT merchant_id, item_title, type, sum(amount) AS amount, count(*)::integer AS sold,
           row_number() OVER (PARTITION BY merchant_id ORDER BY sum(amount) DESC, item_title) AS position
    FROM sales WHERE this_week
    GROUP BY merchant_id, item_id, item_title, type
  ), top AS (
    SELECT merchant_id,
           json_agg(json_build_object('title', item_title, 'type', type, 'amount', amount, 'sold', sold)
                    ORDER BY position) AS items
    FROM ranked WHERE position <= 3 GROUP BY merchant_id
  ), review_stats AS (
    SELECT COALESCE(class.merchant_id, product.merchant_id) AS merchant_id,
           count(*)::integer AS new_reviews, round(avg(review.rating)::numeric, 1)::text AS average_rating
    FROM reviews review
    LEFT JOIN classes class ON class.id = review.class_id AND class.deleted_at IS NULL
    LEFT JOIN products product ON product.id = review.product_id AND product.deleted_at IS NULL
    WHERE review.deleted_at IS NULL
      AND review.created_at >= ${jakartaDayStartUtc('$1::date')}
      AND review.created_at < ${jakartaDayStartUtc('$1::date + 7')}
      AND COALESCE(class.merchant_id, product.merchant_id) IS NOT NULL
    GROUP BY 1
  )
  SELECT merchant.id AS merchant_id, merchant.store_name,
         owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email,
         COALESCE(totals.revenue, 0)::text AS revenue,
         COALESCE(totals.previous_revenue, 0)::text AS previous_revenue,
         COALESCE(totals.transactions, 0) AS transactions,
         COALESCE(totals.buyers, 0) AS buyers,
         COALESCE(top.items, '[]'::json) AS top_items,
         COALESCE(review_stats.new_reviews, 0) AS new_reviews,
         review_stats.average_rating,
         COALESCE(wallet.settled_balance, 0)::text AS withdrawable_balance
  FROM merchants merchant
  INNER JOIN users owner ON owner.id = merchant.user_id AND owner.deleted_at IS NULL
  LEFT JOIN user_notification_preferences preference
    ON preference.user_id = owner.id AND preference.deleted_at IS NULL
  LEFT JOIN totals ON totals.merchant_id = merchant.id
  LEFT JOIN top ON top.merchant_id = merchant.id
  LEFT JOIN review_stats ON review_stats.merchant_id = merchant.id
  LEFT JOIN merchant_wallets wallet ON wallet.merchant_id = merchant.id AND wallet.deleted_at IS NULL
  WHERE merchant.deleted_at IS NULL AND merchant.status = 'active'
    AND COALESCE(preference.email_weekly_report, true)
    AND (COALESCE(totals.transactions, 0) > 0 OR COALESCE(review_stats.new_reviews, 0) > 0)`;

// The Monday of the week that ended most recently, from the database clock,
// so every run and instance reports the same week.
const LAST_WEEK_SQL = `SELECT to_char((date_trunc('week', now() AT TIME ZONE 'Asia/Jakarta'))::date - 7, 'YYYY-MM-DD') AS week_start`;

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export function weeklyReportEmail(
  row: WeeklyRow,
  weekStart: string,
): EmailToQueue {
  return {
    kind: 'merchant_weekly_report',
    to: row.owner_email,
    userId: row.owner_id,
    dedupeKey: `weekly-report:${row.merchant_id}:${weekStart}`,
    payload: {
      owner_name: row.owner_name,
      store_name: row.store_name,
      week_start: weekStart,
      week_end: addDays(weekStart, 6),
      revenue: Number(row.revenue),
      previous_revenue: Number(row.previous_revenue),
      transactions: row.transactions,
      buyers: row.buyers,
      top_items: row.top_items.map((item) => ({
        title: item.title,
        type: item.type,
        amount: Number(item.amount),
        sold: item.sold,
      })),
      new_reviews: row.new_reviews,
      average_rating:
        row.average_rating === null ? null : Number(row.average_rating),
      withdrawable_balance: Number(row.withdrawable_balance),
    },
  };
}

/** Queues last week's reports; returns how many stores qualified. */
export async function queueWeeklyMerchantReports(
  manager: EntityManager,
): Promise<number> {
  let qualified = 0;
  await guardEmailQueue(manager, 'weekly report', async (manager) => {
    const [{ week_start }]: Array<{ week_start: string }> =
      await manager.query(LAST_WEEK_SQL);
    const rows: WeeklyRow[] = await manager.query(WEEKLY_REPORT_SQL, [
      week_start,
    ]);
    qualified = rows.length;
    await queueEmails(
      manager,
      rows.map((row) => weeklyReportEmail(row, week_start)),
    );
  });
  return qualified;
}
