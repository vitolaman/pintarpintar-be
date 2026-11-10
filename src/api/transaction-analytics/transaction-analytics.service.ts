import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as moment from 'moment-timezone';
import { DailyTransactionResponseDto } from './dto/transaction-analytics.dto';

const JAKARTA = 'Asia/Jakarta';

@Injectable()
export class TransactionAnalyticsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findDaily(requestedMonth?: string) {
    const month = requestedMonth ?? moment().tz(JAKARTA).format('YYYY-MM');
    // Stored timestamps are UTC wall time. Paid records predating paid_at use
    // creation time, matching the existing merchant sales analytics.
    const rows = await this.dataSource.query(
      `WITH bounds AS (
         SELECT ($1::text || '-01')::date AS first_day,
                (($1::text || '-01')::date + interval '1 month')::date AS next_month
       ), payments AS (
         SELECT COALESCE(paid_at, created_at) AS occurred_at, total_amount
         FROM orders, bounds
         WHERE status = 'paid' AND deleted_at IS NULL
           AND COALESCE(paid_at, created_at) >= ((bounds.first_day::timestamp AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC')
           AND COALESCE(paid_at, created_at) < ((bounds.next_month::timestamp AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC')
         UNION ALL
         SELECT COALESCE(paid_at, created_at), total_amount
         FROM pro_transactions, bounds
         WHERE status = 'paid' AND deleted_at IS NULL
           AND COALESCE(paid_at, created_at) >= ((bounds.first_day::timestamp AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC')
           AND COALESCE(paid_at, created_at) < ((bounds.next_month::timestamp AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC')
       ), daily AS (
         SELECT ((occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date AS day,
                count(*)::integer AS total_transactions, sum(total_amount) AS total_nominal
         FROM payments GROUP BY 1
       ), days AS (
         SELECT generate_series(first_day::timestamp, (next_month - 1)::timestamp, interval '1 day')::date AS day
         FROM bounds
       )
       SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
              COALESCE(daily.total_transactions, 0)::integer AS total_transactions,
              COALESCE(daily.total_nominal, 0)::text AS total_nominal,
              sum(COALESCE(daily.total_transactions, 0)) OVER ()::integer AS month_transactions,
              sum(COALESCE(daily.total_nominal, 0)) OVER ()::text AS month_nominal
       FROM days LEFT JOIN daily ON daily.day = days.day ORDER BY days.day`,
      [month],
    );
    const data: DailyTransactionResponseDto = {
      month,
      timezone: JAKARTA,
      total_transactions: rows[0]?.month_transactions ?? 0,
      total_nominal: rows[0]?.month_nominal ?? '0',
      days: rows.map((row) => ({
        date: row.date,
        total_transactions: row.total_transactions,
        total_nominal: row.total_nominal,
      })),
    };
    return { data, responseMessage: 'Get daily transactions success' };
  }
}
