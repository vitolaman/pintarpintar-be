import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  AnalyticsSummaryResponseDto,
  DailySalesResponseDto,
  Granularity,
  MonthlyRevenueResponseDto,
  StudentGrowthQueryDto,
  StudentGrowthResponseDto,
  SummaryMetricDto,
  SummaryPeriod,
  SummaryWindowDto,
} from './dto/merchant-analytics.dto';
import { PAID_SALES_SQL } from './merchant-sales-sql';

// Stored timestamps are UTC wall time; analytics days are Asia/Jakarta.
const WIB = (column: string) =>
  `((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')`;
const WIB_NOW = `(now() AT TIME ZONE 'Asia/Jakarta')`;

const MAX_CHECKPOINTS = 400;
const RETENTION_WINDOW_DAYS = 90;

const PERIOD_UNITS: Record<SummaryPeriod, 'day' | 'month' | 'year'> = {
  today: 'day',
  month: 'month',
  year: 'year',
};

interface WindowRow {
  kind: 'current' | 'previous';
  window_from: string;
  window_to: string;
  transactions: number;
  revenue: string;
  buyers: number;
  returning_buyers: number;
  visitors: number;
}

@Injectable()
export class MerchantAnalyticsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findStudentGrowth(userId: string, query: StudentGrowthQueryDto) {
    const merchantId = await this.findMerchantId(userId);
    if (query.from > query.to) {
      throw new BadRequestException('from must not be after to');
    }
    const granularity = query.granularity ?? defaultGranularity(query);
    if (checkpointCount(query.from, query.to, granularity) > MAX_CHECKPOINTS) {
      throw new BadRequestException(
        `The range has more than ${MAX_CHECKPOINTS} ${granularity} checkpoints`,
      );
    }

    // Each student counts once, from their first enrollment in any of the
    // merchant's classes. A checkpoint's total is everyone enrolled before the
    // first checkpoint plus a running sum of first enrollments per checkpoint.
    const points = await this.dataSource.query(
      `WITH first_enrollment AS (
         SELECT min(${WIB('enrollment.created_at')})::date AS first_day
         FROM enrollments enrollment
         INNER JOIN classes class
           ON class.id = enrollment.class_id AND class.merchant_id = $1 AND class.deleted_at IS NULL
         INNER JOIN users student ON student.id = enrollment.user_id AND student.deleted_at IS NULL
         WHERE enrollment.deleted_at IS NULL
         GROUP BY enrollment.user_id
       ), checkpoints AS (
         SELECT bucket::date AS bucket
         FROM generate_series(date_trunc($4, $2::date::timestamp), $3::date::timestamp, ('1 ' || $4)::interval) bucket
       ), earlier AS (
         SELECT count(*) AS students FROM first_enrollment
         WHERE first_day < (SELECT min(bucket) FROM checkpoints)
       ), per_checkpoint AS (
         SELECT date_trunc($4, first_day::timestamp)::date AS bucket, count(*) AS students
         FROM first_enrollment
         WHERE first_day >= (SELECT min(bucket) FROM checkpoints) AND first_day <= $3::date
         GROUP BY 1
       )
       SELECT checkpoints.bucket::text AS date,
              ((SELECT students FROM earlier)
                + sum(COALESCE(per_checkpoint.students, 0)) OVER (ORDER BY checkpoints.bucket))::integer AS students
       FROM checkpoints
       LEFT JOIN per_checkpoint ON per_checkpoint.bucket = checkpoints.bucket
       ORDER BY checkpoints.bucket`,
      [merchantId, query.from, query.to, granularity],
    );
    const data: StudentGrowthResponseDto = { granularity, points };
    return { data, responseMessage: 'Get student growth success' };
  }

  async findDailySales(userId: string, month: string) {
    const merchantId = await this.findMerchantId(userId);
    const days = await this.dataSource.query(
      `WITH days AS (
         SELECT generate_series($2::date, ($2::date + interval '1 month' - interval '1 day'), interval '1 day')::date AS day
       ), daily AS (
         SELECT ${WIB('sale.sold_at')}::date AS day,
                count(DISTINCT sale.order_id)::integer AS transactions,
                sum(sale.amount) AS revenue
         FROM (${PAID_SALES_SQL}) sale
         WHERE ${WIB('sale.sold_at')} >= $2::date
           AND ${WIB('sale.sold_at')} < $2::date + interval '1 month'
         GROUP BY 1
       )
       SELECT days.day::text AS date, COALESCE(daily.transactions, 0) AS transactions,
              COALESCE(daily.revenue, 0) AS revenue
       FROM days LEFT JOIN daily ON daily.day = days.day
       ORDER BY days.day`,
      [merchantId, `${month}-01`],
    );
    const points = days.map((day) => ({
      date: day.date,
      transactions: day.transactions,
      revenue: Number(day.revenue),
    }));
    const data: DailySalesResponseDto = {
      month,
      total_transactions: points.reduce(
        (sum, day) => sum + day.transactions,
        0,
      ),
      total_revenue: points.reduce((sum, day) => sum + day.revenue, 0),
      days: points,
    };
    return { data, responseMessage: 'Get daily sales success' };
  }

  async findMonthlyRevenue(userId: string, year: number) {
    const merchantId = await this.findMerchantId(userId);
    const rows = await this.dataSource.query(
      `WITH months AS (
         SELECT generate_series(1, 12) AS month
       ), monthly AS (
         SELECT extract(month FROM ${WIB('sale.sold_at')})::integer AS month,
                sum(sale.amount) AS total
         FROM (${PAID_SALES_SQL}) sale
         WHERE ${WIB('sale.sold_at')} >= make_date($2, 1, 1)
           AND ${WIB('sale.sold_at')} < make_date($2 + 1, 1, 1)
         GROUP BY 1
       )
       SELECT months.month, COALESCE(monthly.total, 0) AS total
       FROM months LEFT JOIN monthly ON monthly.month = months.month
       ORDER BY months.month`,
      [merchantId, year],
    );
    const months = rows.map((row) => ({
      month: row.month,
      total: Number(row.total),
    }));
    const data: MonthlyRevenueResponseDto = {
      year,
      total_revenue: months.reduce((sum, month) => sum + month.total, 0),
      months,
    };
    return { data, responseMessage: 'Get monthly revenue success' };
  }

  async findSummary(userId: string, period: SummaryPeriod) {
    const merchantId = await this.findMerchantId(userId);
    const unit = PERIOD_UNITS[period];
    // The previous window covers the same elapsed span: today and month add the
    // elapsed time to the previous start (capped at its end, so 31 March
    // compares with all of February); year steps back one calendar year.
    const rows: WindowRow[] = await this.dataSource.query(
      `WITH bounds AS (
         SELECT date_trunc($2, ${WIB_NOW}) AS current_start, ${WIB_NOW} AS current_end
       ), windows AS (
         SELECT 'current' AS kind, current_start AS window_from, current_end AS window_to FROM bounds
         UNION ALL
         SELECT 'previous', current_start - ('1 ' || $2)::interval,
                CASE WHEN $2 = 'year' THEN current_end - interval '1 year'
                     ELSE least(current_start - ('1 ' || $2)::interval + (current_end - current_start), current_start)
                END
         FROM bounds
       ), sales AS (
         SELECT sale.order_id, sale.user_id, sale.amount, sale.sold_at,
                ${WIB('sale.sold_at')} AS sold_wib
         FROM (${PAID_SALES_SQL}) sale
       )
       SELECT windows.kind,
              to_char(windows.window_from, 'YYYY-MM-DD"T"HH24:MI:SS') AS window_from,
              to_char(windows.window_to, 'YYYY-MM-DD"T"HH24:MI:SS') AS window_to,
              (SELECT count(DISTINCT sales.order_id) FROM sales
               WHERE sales.sold_wib >= windows.window_from AND sales.sold_wib < windows.window_to)::integer AS transactions,
              (SELECT COALESCE(sum(sales.amount), 0) FROM sales
               WHERE sales.sold_wib >= windows.window_from AND sales.sold_wib < windows.window_to) AS revenue,
              (SELECT count(DISTINCT sales.user_id) FROM sales
               WHERE sales.sold_wib >= windows.window_from AND sales.sold_wib < windows.window_to)::integer AS buyers,
              (SELECT count(DISTINCT purchase.user_id) FROM sales purchase
               WHERE purchase.sold_wib >= windows.window_from AND purchase.sold_wib < windows.window_to
                 AND EXISTS (
                   SELECT 1 FROM sales earlier
                   WHERE earlier.user_id = purchase.user_id AND earlier.order_id <> purchase.order_id
                     AND earlier.sold_at >= purchase.sold_at - interval '${RETENTION_WINDOW_DAYS} days'
                     AND earlier.sold_at < purchase.sold_at))::integer AS returning_buyers,
              (SELECT count(DISTINCT visit.visitor_key) FROM merchant_visits visit
               WHERE visit.merchant_id = $1 AND visit.deleted_at IS NULL
                 AND visit.visit_date >= windows.window_from::date
                 AND visit.visit_date <= (windows.window_to - interval '1 microsecond')::date)::integer AS visitors
       FROM windows`,
      [merchantId, unit],
    );
    const current = toWindow(rows.find((row) => row.kind === 'current'));
    const previous = toWindow(rows.find((row) => row.kind === 'previous'));
    const data: AnalyticsSummaryResponseDto = {
      period,
      conversion_rate: metric(conversion(current), conversion(previous)),
      retention_rate: metric(retention(current), retention(previous)),
      average_order_value: metric(
        averageOrderValue(current),
        averageOrderValue(previous),
      ),
      current,
      previous,
    };
    return { data, responseMessage: 'Get analytics summary success' };
  }

  private async findMerchantId(userId: string): Promise<string> {
    const [merchant] = await this.dataSource.query(
      'SELECT id FROM merchants WHERE user_id = $1 AND deleted_at IS NULL',
      [userId],
    );
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant.id;
  }
}

// The page's own rule: daily points within one calendar month, monthly within
// one calendar year, otherwise yearly.
export function defaultGranularity(range: {
  from: string;
  to: string;
}): Granularity {
  if (range.from.slice(0, 7) === range.to.slice(0, 7)) return 'day';
  if (range.from.slice(0, 4) === range.to.slice(0, 4)) return 'month';
  return 'year';
}

export function checkpointCount(
  from: string,
  to: string,
  granularity: Granularity,
): number {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  if (granularity === 'year') return toYear - fromYear + 1;
  if (granularity === 'month') {
    return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(to) - Date.parse(from)) / dayMs) + 1;
}

function toWindow(row: WindowRow): SummaryWindowDto {
  return {
    from: row.window_from,
    to: row.window_to,
    transactions: row.transactions,
    revenue: Number(row.revenue),
    buyers: row.buyers,
    returning_buyers: row.returning_buyers,
    visitors: row.visitors,
  };
}

const roundOneDecimal = (value: number) => Math.round(value * 10) / 10;

export function conversion(window: SummaryWindowDto): number | null {
  if (window.visitors === 0) return null;
  return roundOneDecimal(
    Math.min(100, (window.buyers * 100) / window.visitors),
  );
}

export function retention(window: SummaryWindowDto): number | null {
  if (window.buyers === 0) return null;
  return roundOneDecimal((window.returning_buyers * 100) / window.buyers);
}

export function averageOrderValue(window: SummaryWindowDto): number | null {
  if (window.transactions === 0) return null;
  return Math.round(window.revenue / window.transactions);
}

export function metric(
  value: number | null,
  previous: number | null,
): SummaryMetricDto {
  const change_percent =
    value === null || previous === null || previous === 0
      ? null
      : roundOneDecimal(((value - previous) * 100) / previous);
  return { value, previous, change_percent };
}
