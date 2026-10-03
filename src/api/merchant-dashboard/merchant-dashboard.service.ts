import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { MerchantLevelService } from '../merchant-level/merchant-level.service';
import { DataSource } from 'typeorm';
import { assetUrl } from '../../common/storage/asset-url';
import {
  CustomersQueryDto,
  DashboardQueryDto,
  SalesFilterQueryDto,
  SalesQueryDto,
} from './dto/merchant-dashboard-query.dto';
import {
  PeriodMetricDto,
  SaleResponseDto,
} from './dto/merchant-dashboard-response.dto';
import {
  jakartaDayStartUtc,
  MERCHANT_PAID_SALES_SQL,
  MERCHANT_PENDING_SALES_SQL,
  MERCHANT_SALES_SQL,
  paidSalesBetweenSql,
} from './merchant-sales-sql';
import {
  IncomePeriod,
  MerchantIncomeService,
} from '../merchant-income/merchant-income.service';
import * as moment from 'moment-timezone';
import { paginationMeta } from '~/common/dto/response-meta.dto';

const EXPORT_LIMIT = 5000;
const JAKARTA = 'Asia/Jakarta';

// Every review ($1 = merchant id) of the merchant's classes and digital
// products, whatever their current status, with the reviewed item's title.
const MERCHANT_REVIEWS_SQL = `
  SELECT review.id, review.user_id, review.rating, review.comment, review.created_at,
         COALESCE(class.title, product.title) AS item_title
  FROM reviews review
  LEFT JOIN classes class ON class.id = review.class_id
  LEFT JOIN products product ON product.id = review.product_id
  WHERE review.deleted_at IS NULL
    AND (class.merchant_id = $1 OR product.merchant_id = $1)
`;

// Stored timestamps are UTC wall time; new catalog items count back from now.
const NOW_UTC = `(now() AT TIME ZONE 'UTC')`;

// Enrollment progress is free text; use its leading number, clamped to 0-100.
const PROGRESS_SQL = `LEAST(100, COALESCE(substring(enrollment.progress from '^\\s*([0-9]+)')::numeric, 0))`;

const SALE_SORT_COLUMNS = { date: 'sale.created_at', amount: 'sale.amount' };
const CUSTOMER_SORT_COLUMNS = {
  total_spent: 'customer.total_spent',
  joined_at: 'customer.joined_at',
};

interface MerchantRow {
  id: string;
  storage_level: string;
  earning_balance: string | null;
  lifetime_earnings: string | null;
}

@Injectable()
export class MerchantDashboardService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly merchantLevels: MerchantLevelService,
    private readonly merchantIncome: MerchantIncomeService,
  ) {}

  async findDashboard(userId: string, query: DashboardQueryDto) {
    const merchant = await this.findMerchant(userId);
    const days = query.period_days;
    const params = [merchant.id, days];
    const today = moment().tz(JAKARTA);
    const todayDate = today.format('YYYY-MM-DD');
    const periodStart = today
      .clone()
      .subtract(days - 1, 'day')
      .format('YYYY-MM-DD');
    const previousStart = today
      .clone()
      .subtract(days * 2 - 1, 'day')
      .format('YYYY-MM-DD');

    const [
      [buyers],
      income,
      [catalog],
      [rating],
      [latestReview],
      activities,
      unpaid,
    ] = await Promise.all([
      // Distinct buyers cannot be summed from daily income, so they are
      // counted from the period's paid orders.
      this.dataSource.query(
        `SELECT
             count(DISTINCT sale.user_id) FILTER (WHERE sale.sold_at >= ${jakartaDayStartUtc('$3::date')})::integer AS students,
             count(DISTINCT sale.user_id) FILTER (WHERE sale.sold_at < ${jakartaDayStartUtc('$3::date')})::integer AS previous_students
           FROM (${paidSalesBetweenSql('merchant', jakartaDayStartUtc('$2::date'), jakartaDayStartUtc('$4::date + 1'))}) sale`,
        [merchant.id, previousStart, periodStart, todayDate],
      ),
      this.merchantIncome.findIncome(
        merchant.id,
        previousStart,
        todayDate,
        'day',
      ),
      this.dataSource.query(
        `SELECT count(*)::integer AS total,
                  count(*) FILTER (WHERE created_at >= ${NOW_UTC} - make_interval(days => $2))::integer AS new_in_period
           FROM (
             SELECT created_at FROM classes WHERE merchant_id = $1 AND deleted_at IS NULL
             UNION ALL
             SELECT created_at FROM products WHERE merchant_id = $1 AND deleted_at IS NULL
           ) catalog`,
        params,
      ),
      this.dataSource.query(
        `SELECT round(avg(review.rating)::numeric, 1) AS average, count(*)::integer AS total
           FROM (${MERCHANT_REVIEWS_SQL}) review`,
        [merchant.id],
      ),
      this.dataSource.query(
        `SELECT reviewer.name AS reviewer_name, avatar.object_key AS reviewer_avatar_object_key,
                  review.rating, review.comment, review.item_title, review.created_at
           FROM (${MERCHANT_REVIEWS_SQL}) review
           INNER JOIN users reviewer ON reviewer.id = review.user_id
           LEFT JOIN user_profiles profile ON profile.user_id = reviewer.id AND profile.deleted_at IS NULL
           LEFT JOIN file_assets avatar ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
           ORDER BY review.created_at DESC, review.id DESC
           LIMIT 1`,
        [merchant.id],
      ),
      this.dataSource.query(
        // Each source keeps only its own newest ten before the merge, so a
        // large store does not sort its whole history for ten rows.
        `SELECT * FROM (
             (SELECT 'enrollment' AS type, student.name AS actor_name, class.title AS item_title,
                     NULL::integer AS rating, enrollment.created_at AS occurred_at
              FROM enrollments enrollment
              INNER JOIN classes class ON class.id = enrollment.class_id
              INNER JOIN users student ON student.id = enrollment.user_id
              WHERE class.merchant_id = $1 AND enrollment.deleted_at IS NULL
              ORDER BY enrollment.created_at DESC
              LIMIT 10)
             UNION ALL
             (SELECT 'review', reviewer.name, review.item_title, review.rating, review.created_at
              FROM (${MERCHANT_REVIEWS_SQL}) review
              INNER JOIN users reviewer ON reviewer.id = review.user_id
              ORDER BY review.created_at DESC
              LIMIT 10)
             UNION ALL
             (SELECT 'purchase', buyer.name, sale.item_title, NULL, sale.created_at
              FROM (${MERCHANT_PAID_SALES_SQL}) sale
              INNER JOIN users buyer ON buyer.id = sale.user_id
              WHERE sale.type IN ('digital', 'bundle')
              ORDER BY sale.created_at DESC
              LIMIT 10)
           ) activity
           ORDER BY activity.occurred_at DESC
           LIMIT 10`,
        [merchant.id],
      ),
      this.dataSource.query(
        `SELECT sale.order_id, sale.item_title, sale.amount AS price, sale.created_at AS checkout_at,
                  buyer.name AS buyer_name, buyer.email AS buyer_email, profile.phone AS buyer_phone,
                  CASE WHEN sale.expires_at > now() THEN sale.payment_url END AS payment_link
           FROM (${MERCHANT_PENDING_SALES_SQL}) sale
           INNER JOIN users buyer ON buyer.id = sale.user_id
           LEFT JOIN user_profiles profile ON profile.user_id = buyer.id AND profile.deleted_at IS NULL
           WHERE sale.status = 'pending'
           ORDER BY sale.created_at DESC, sale.id DESC
           LIMIT 20`,
        [merchant.id],
      ),
    ]);

    const incomeByDate = new Map(income.map((day) => [day.period, day]));
    const current = sumIncome(
      income.filter((day) => day.period >= periodStart),
    );
    const previous = sumIncome(
      income.filter((day) => day.period < periodStart),
    );

    return {
      data: {
        period_days: days,
        balance: Number(merchant.earning_balance ?? 0),
        storage_level: merchant.storage_level,
        level: await this.merchantLevels.findSummary(merchant.id),
        lifetime_earnings: Number(merchant.lifetime_earnings ?? 0),
        revenue: periodMetric(current.revenue, previous.revenue),
        transactions: periodMetric(current.transactions, previous.transactions),
        students: periodMetric(buyers.students, buyers.previous_students),
        catalog_total: catalog.total,
        catalog_new_in_period: catalog.new_in_period,
        rating_average: rating.average === null ? null : Number(rating.average),
        review_count: rating.total,
        latest_review: latestReview
          ? {
              reviewer_name: latestReview.reviewer_name,
              reviewer_avatar_url: assetUrl(
                latestReview.reviewer_avatar_object_key,
              ),
              rating: Number(latestReview.rating),
              comment: latestReview.comment,
              item_title: latestReview.item_title,
              created_at: latestReview.created_at,
            }
          : null,
        chart: Array.from({ length: days }, (_, index) => {
          const date = moment
            .tz(periodStart, JAKARTA)
            .add(index, 'day')
            .format('YYYY-MM-DD');
          const day = incomeByDate.get(date);
          return {
            date,
            transactions: day?.transactions ?? 0,
            revenue: Number(day?.revenue ?? 0),
          };
        }),
        activities: activities.map((activity) => ({
          ...activity,
          rating: activity.rating === null ? null : Number(activity.rating),
        })),
        unpaid_transactions: unpaid.map((row) => ({
          ...row,
          price: Number(row.price),
        })),
      },
      responseMessage: 'Get merchant dashboard success',
    };
  }

  async findSales(userId: string, query: SalesQueryDto) {
    const merchant = await this.findMerchant(userId);
    const { page, limit } = query;
    const { whereSql, params } = salesFilter(merchant.id, query);

    const [countRow] = await this.dataSource.query(
      `SELECT count(*)::integer AS total ${salesFromSql(whereSql)}`,
      params,
    );
    const total: number = countRow.total;
    const rows =
      total === 0
        ? []
        : await this.querySales(
            whereSql,
            params,
            query,
            limit,
            (page - 1) * limit,
          );

    return {
      data: rows,
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get sales success',
    };
  }

  async exportSales(userId: string, query: SalesFilterQueryDto) {
    const merchant = await this.findMerchant(userId);
    const { whereSql, params } = salesFilter(merchant.id, query);
    const rows = await this.querySales(
      whereSql,
      params,
      query,
      EXPORT_LIMIT + 1,
      0,
    );

    return {
      data: {
        rows: rows.slice(0, EXPORT_LIMIT),
        truncated: rows.length > EXPORT_LIMIT,
      },
      responseMessage: 'Export sales success',
    };
  }

  async findCustomers(userId: string, query: CustomersQueryDto) {
    const merchant = await this.findMerchant(userId);
    const { page, limit } = query;
    const search = query.search ? escapeLike(query.search) : null;
    const params = [merchant.id, search];

    const customersSql = `
      WITH customer AS (
        SELECT sale.user_id, sum(sale.amount) AS total_spent, min(sale.created_at) AS joined_at
        FROM (${MERCHANT_PAID_SALES_SQL}) sale
        WHERE sale.status = 'paid'
        GROUP BY sale.user_id
      )
      SELECT customer.user_id, customer.total_spent, customer.joined_at,
             buyer.name, buyer.email, profile.phone
      FROM customer
      INNER JOIN users buyer ON buyer.id = customer.user_id
      LEFT JOIN user_profiles profile ON profile.user_id = buyer.id AND profile.deleted_at IS NULL
      WHERE ($2::text IS NULL
        OR buyer.name ILIKE '%' || $2 || '%' ESCAPE '\\'
        OR buyer.email ILIKE '%' || $2 || '%' ESCAPE '\\'
        OR profile.phone ILIKE '%' || $2 || '%' ESCAPE '\\')`;

    const [countRow] = await this.dataSource.query(
      `SELECT count(*)::integer AS total FROM (${customersSql}) customers`,
      params,
    );
    const total: number = countRow.total;

    const sortColumn = CUSTOMER_SORT_COLUMNS[query.sort_by];
    const direction = query.sort_order === 'asc' ? 'ASC' : 'DESC';
    const rows =
      total === 0
        ? []
        : await this.dataSource.query(
            `WITH page AS (
               ${customersSql}
               ORDER BY ${sortColumn} ${direction}, customer.user_id ${direction}
               LIMIT $3 OFFSET $4
             )
             SELECT page.*,
                    (SELECT count(DISTINCT enrollment.class_id)::integer
                     FROM enrollments enrollment
                     INNER JOIN classes class ON class.id = enrollment.class_id
                     WHERE enrollment.user_id = page.user_id AND class.merchant_id = $1
                       AND enrollment.deleted_at IS NULL) AS classes_enrolled,
                    (SELECT COALESCE(round(avg(${PROGRESS_SQL})), 0)::integer
                     FROM enrollments enrollment
                     INNER JOIN classes class ON class.id = enrollment.class_id
                     WHERE enrollment.user_id = page.user_id AND class.merchant_id = $1
                       AND enrollment.deleted_at IS NULL) AS completion_rate
             FROM page
             ORDER BY ${sortColumn.replace('customer.', 'page.')} ${direction}, page.user_id ${direction}`,
            [...params, limit, (page - 1) * limit],
          );

    return {
      data: rows.map((row) => ({
        id: row.user_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        joined_at: row.joined_at,
        total_spent: Number(row.total_spent),
        classes_enrolled: row.classes_enrolled,
        completion_rate: row.completion_rate,
      })),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get customers success',
    };
  }

  private async querySales(
    whereSql: string,
    params: unknown[],
    query: SalesFilterQueryDto,
    limit: number,
    offset: number,
  ): Promise<SaleResponseDto[]> {
    const sortColumn = SALE_SORT_COLUMNS[query.sort_by];
    const direction = query.sort_order === 'asc' ? 'ASC' : 'DESC';
    const next = params.length + 1;

    const rows = await this.dataSource.query(
      `SELECT sale.id, sale.order_id, sale.created_at AS ordered_at,
              buyer.name AS buyer_name, profile.phone AS buyer_phone,
              sale.type, sale.item_id, sale.item_title, sale.amount, sale.gross_amount,
              coupon.code AS coupon_code, sale.payment_method, sale.status
       ${salesFromSql(whereSql)}
       ORDER BY ${sortColumn} ${direction}, sale.id ${direction}
       LIMIT $${next} OFFSET $${next + 1}`,
      [...params, limit, offset],
    );

    return rows.map((row) => ({
      id: row.id,
      order_id: row.order_id,
      ordered_at: row.ordered_at,
      buyer_name: row.buyer_name,
      buyer_phone: row.buyer_phone,
      type: row.type,
      item_id: row.item_id,
      item_title: row.item_title,
      amount: Number(row.gross_amount),
      payment_method: row.payment_method,
      coupon_code: row.coupon_code,
      platform_fee: null,
      transaction_fee: null,
      net_amount: Number(row.amount),
      status: row.status,
    }));
  }

  private async findMerchant(userId: string): Promise<MerchantRow> {
    const [merchant] = await this.dataSource.query(
      `SELECT merchant.id, merchant.storage_level, wallet.earning_balance, wallet.lifetime_earnings
       FROM merchants merchant
       LEFT JOIN merchant_wallets wallet ON wallet.merchant_id = merchant.id AND wallet.deleted_at IS NULL
       WHERE merchant.user_id = $1 AND merchant.deleted_at IS NULL`,
      [userId],
    );
    if (!merchant) throw new NotFoundException('Merchant not found');
    return merchant;
  }
}

function salesFromSql(whereSql: string): string {
  return `
    FROM (${MERCHANT_SALES_SQL}) sale
    INNER JOIN users buyer ON buyer.id = sale.user_id
    LEFT JOIN user_profiles profile ON profile.user_id = buyer.id AND profile.deleted_at IS NULL
    LEFT JOIN coupons coupon ON coupon.id = sale.coupon_id
    ${whereSql}`;
}

function salesFilter(merchantId: string, query: SalesFilterQueryDto) {
  return {
    whereSql: `
      WHERE ($2::text IS NULL OR sale.type = $2)
        AND ($3::text IS NULL OR sale.status = $3)
        AND ($4::text IS NULL
          OR buyer.name ILIKE '%' || $4 || '%' ESCAPE '\\'
          OR sale.item_title ILIKE '%' || $4 || '%' ESCAPE '\\')
        AND ($5::uuid[] IS NULL OR sale.item_id = ANY($5::uuid[]))`,
    params: [
      merchantId,
      query.type ?? null,
      query.status ?? null,
      query.search ? escapeLike(query.search) : null,
      query.item_ids?.length ? query.item_ids : null,
    ],
  };
}

function sumIncome(days: IncomePeriod[]) {
  return days.reduce(
    (sum, day) => ({
      transactions: sum.transactions + day.transactions,
      revenue: sum.revenue + Number(day.revenue),
    }),
    { transactions: 0, revenue: 0 },
  );
}

export function periodMetric(
  current: string | number,
  previous: string | number,
): PeriodMetricDto {
  const currentValue = Number(current);
  const previousValue = Number(previous);
  return {
    current: currentValue,
    previous: previousValue,
    change_percent:
      previousValue === 0
        ? null
        : Math.round(((currentValue - previousValue) / previousValue) * 1000) /
          10,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
