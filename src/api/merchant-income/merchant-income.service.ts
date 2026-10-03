import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  jakartaDayStartUtc as dayStartUtc,
  paidSalesBetweenSql,
} from '../merchant-dashboard/merchant-sales-sql';
import { MerchantDailyStat } from './entities/merchant-daily-stat.entity';

// One lock for every refresh, in this instance or another.
const REFRESH_LOCK = 'merchant-daily-income';
const INSERT_CHUNK = 1000;

// The most recent closed days that every scheduled refresh recomputes.
export const RECENT_DAYS = 7;

const TODAY = `(now() AT TIME ZONE 'Asia/Jakarta')::date`;

const WIB_DATE = (column: string) =>
  `((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date`;

// Every merchant's paid sales and visitors per Asia/Jakarta day from $1 to $2.
const DAILY_INCOME_SQL = `
  WITH sales AS (
    SELECT sale.merchant_id, ${WIB_DATE('sale.sold_at')} AS stat_date,
           sum(sale.amount) AS revenue, count(DISTINCT sale.order_id)::integer AS orders
    FROM (${paidSalesBetweenSql('all', dayStartUtc('$1::date'), dayStartUtc('$2::date + 1'))}) sale
    GROUP BY 1, 2
  ), visits AS (
    SELECT merchant_id, visit_date AS stat_date, count(*)::integer AS visitors
    FROM merchant_visits
    WHERE deleted_at IS NULL AND visit_date >= $1::date AND visit_date <= $2::date
    GROUP BY 1, 2
  )
  SELECT COALESCE(sales.merchant_id, visits.merchant_id) AS merchant_id,
         COALESCE(sales.stat_date, visits.stat_date)::text AS stat_date,
         COALESCE(sales.revenue, 0)::text AS revenue,
         COALESCE(sales.orders, 0) AS orders,
         COALESCE(visits.visitors, 0) AS visitors
  FROM sales
  FULL JOIN visits ON visits.merchant_id = sales.merchant_id AND visits.stat_date = sales.stat_date
`;

// Merchant $1's income from $2 to $3 per $4 ('day' or 'month'): stored rows
// for the days before yesterday, and yesterday and today from the orders, so
// the figures never wait for a refresh. Both parts read "today" from the same
// clock, so no day is counted twice or skipped.
const INCOME_SQL = `
  SELECT to_char(date_trunc($4, income.day::timestamp), 'YYYY-MM-DD') AS period,
         sum(income.transactions)::integer AS transactions,
         sum(income.revenue)::text AS revenue
  FROM (
    SELECT stat.stat_date AS day, stat.daily_orders AS transactions, stat.daily_revenue AS revenue
    FROM merchant_daily_stats stat
    WHERE stat.merchant_id = $1 AND stat.deleted_at IS NULL AND stat.daily_orders > 0
      AND stat.stat_date >= $2::date AND stat.stat_date <= LEAST($3::date, ${TODAY} - 2)

    UNION ALL

    -- Evaluated once, above the live part (OFFSET 0 keeps it there): a range
    -- that ends before yesterday skips it instead of starting parallel
    -- workers for an empty window.
    SELECT live.* FROM (
      SELECT ${WIB_DATE('sale.sold_at')} AS day, count(DISTINCT sale.order_id) AS transactions,
             sum(sale.amount) AS revenue
      FROM (${paidSalesBetweenSql('merchant', dayStartUtc(`GREATEST($2::date, ${TODAY} - 1)`), dayStartUtc('$3::date + 1'))}) sale
      GROUP BY 1
      OFFSET 0
    ) live
    WHERE $3::date >= ${TODAY} - 1
  ) income
  GROUP BY 1
  ORDER BY 1
`;

interface DailyIncomeRow {
  merchant_id: string;
  stat_date: string;
  revenue: string;
  orders: number;
  visitors: number;
}

export interface IncomePeriod {
  // The period's first Asia/Jakarta date (YYYY-MM-DD).
  period: string;
  transactions: number;
  // Exact numeric sum, as Postgres returns it.
  revenue: string;
}

/**
 * Keeps merchant_daily_stats filled with each merchant's income per closed
 * Asia/Jakarta day, and reads income from it. See the merchant-daily-income
 * spec for the figures' rules.
 */
@Injectable()
export class MerchantIncomeService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Recomputes every closed day, waiting for any refresh in progress. */
  async rebuild(): Promise<number> {
    return this.refresh(null, true);
  }

  /**
   * Recomputes the last RECENT_DAYS closed days. Returns null when another
   * refresh holds the lock; that refresh covers the same days.
   */
  async refreshRecentDays(): Promise<number | null> {
    return this.refresh(RECENT_DAYS, false);
  }

  /**
   * The merchant's paid transactions and net revenue per day or month from
   * `from` to `to` (Asia/Jakarta dates, inclusive). Periods without sales are
   * left out.
   */
  async findIncome(
    merchantId: string,
    from: string,
    to: string,
    unit: 'day' | 'month',
    manager: EntityManager = this.dataSource.manager,
  ): Promise<IncomePeriod[]> {
    return manager.query(INCOME_SQL, [merchantId, from, to, unit]);
  }

  // Replaces the stored rows of the last `days` closed days (every closed day
  // when null) in one transaction, so readers see all old or all new rows.
  private async refresh(days: number | null, wait: boolean) {
    return this.dataSource.transaction(async (manager) => {
      if (wait) {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          REFRESH_LOCK,
        ]);
      } else {
        const [{ locked }] = await manager.query(
          'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked',
          [REFRESH_LOCK],
        );
        if (!locked) return null;
      }

      const [range] = await manager.query(
        `SELECT COALESCE(${TODAY} - $1::integer, '-infinity'::date)::text AS from_date,
                (${TODAY} - 1)::text AS to_date`,
        [days],
      );
      const rows: DailyIncomeRow[] = await manager.query(DAILY_INCOME_SQL, [
        range.from_date,
        range.to_date,
      ]);

      await manager
        .createQueryBuilder()
        .delete()
        .from(MerchantDailyStat)
        .where('stat_date >= :from AND stat_date <= :to', {
          from: range.from_date,
          to: range.to_date,
        })
        .execute();
      for (let start = 0; start < rows.length; start += INSERT_CHUNK) {
        await manager.insert(
          MerchantDailyStat,
          rows.slice(start, start + INSERT_CHUNK).map((row) => ({
            merchantId: row.merchant_id,
            statDate: row.stat_date,
            dailyRevenue: row.revenue,
            dailyOrders: row.orders,
            dailyProductViews: row.visitors,
          })),
        );
      }
      return rows.length;
    });
  }
}
