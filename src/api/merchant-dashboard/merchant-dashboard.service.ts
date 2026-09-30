import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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

const EXPORT_LIMIT = 5000;

// Every order item that references one of the merchant's digital products,
// classes, or bundles ($1 = merchant id). All figures derive from it.
const MERCHANT_SALES_SQL = `
  SELECT item.id, item.order_id, item.price_at_purchase AS amount,
         purchase.status, purchase.created_at, purchase.user_id, purchase.coupon_id,
         'digital' AS type, product.id AS item_id, product.title AS item_title
  FROM order_items item
  INNER JOIN products product ON product.id = item.product_id
  INNER JOIN orders purchase ON purchase.id = item.order_id
  WHERE product.merchant_id = $1 AND item.deleted_at IS NULL AND purchase.deleted_at IS NULL

  UNION ALL

  SELECT item.id, item.order_id, item.price_at_purchase,
         purchase.status, purchase.created_at, purchase.user_id, purchase.coupon_id,
         CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END,
         class.id, class.title
  FROM order_items item
  INNER JOIN classes class ON class.id = item.class_id
  INNER JOIN orders purchase ON purchase.id = item.order_id
  WHERE class.merchant_id = $1 AND item.deleted_at IS NULL AND purchase.deleted_at IS NULL

  UNION ALL

  SELECT item.id, item.order_id, item.price_at_purchase,
         purchase.status, purchase.created_at, purchase.user_id, purchase.coupon_id,
         'bundle', bundle.id, bundle.title
  FROM order_items item
  INNER JOIN bundles bundle ON bundle.id = item.bundle_id
  INNER JOIN orders purchase ON purchase.id = item.order_id
  WHERE bundle.merchant_id = $1 AND item.deleted_at IS NULL AND purchase.deleted_at IS NULL
`;

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

// Stored timestamps are UTC wall time; periods end now.
const NOW_UTC = `(now() AT TIME ZONE 'UTC')`;
const WIB_DATE = (column: string) =>
  `((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date`;

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
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findDashboard(userId: string, query: DashboardQueryDto) {
    const merchant = await this.findMerchant(userId);
    const days = query.period_days;
    const params = [merchant.id, days];

    const [
      [kpi],
      chart,
      [catalog],
      [rating],
      [latestReview],
      activities,
      unpaid,
    ] = await Promise.all([
      this.dataSource.query(
        `SELECT
             COALESCE(sum(amount) FILTER (WHERE created_at >= ${NOW_UTC} - make_interval(days => $2)), 0) AS revenue,
             COALESCE(sum(amount) FILTER (WHERE created_at < ${NOW_UTC} - make_interval(days => $2)), 0) AS previous_revenue,
             count(*) FILTER (WHERE created_at >= ${NOW_UTC} - make_interval(days => $2))::integer AS transactions,
             count(*) FILTER (WHERE created_at < ${NOW_UTC} - make_interval(days => $2))::integer AS previous_transactions,
             count(DISTINCT user_id) FILTER (WHERE created_at >= ${NOW_UTC} - make_interval(days => $2))::integer AS students,
             count(DISTINCT user_id) FILTER (WHERE created_at < ${NOW_UTC} - make_interval(days => $2))::integer AS previous_students
           FROM (${MERCHANT_SALES_SQL}) sale
           WHERE sale.status = 'paid'
             AND sale.created_at >= ${NOW_UTC} - make_interval(days => $2 * 2)`,
        params,
      ),
      this.dataSource.query(
        `WITH days AS (
             SELECT generate_series(
               (now() AT TIME ZONE 'Asia/Jakarta')::date - ($2 - 1),
               (now() AT TIME ZONE 'Asia/Jakarta')::date,
               interval '1 day'
             )::date AS day
           ), daily AS (
             SELECT ${WIB_DATE('sale.created_at')} AS day,
                    count(*)::integer AS transactions, sum(sale.amount) AS revenue
             FROM (${MERCHANT_SALES_SQL}) sale
             WHERE sale.status = 'paid'
               AND sale.created_at >= ${NOW_UTC} - make_interval(days => $2 + 1)
             GROUP BY 1
           )
           SELECT days.day::text AS date,
                  COALESCE(daily.transactions, 0) AS transactions,
                  COALESCE(daily.revenue, 0) AS revenue
           FROM days LEFT JOIN daily ON daily.day = days.day
           ORDER BY days.day`,
        params,
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
        `SELECT * FROM (
             SELECT 'enrollment' AS type, student.name AS actor_name, class.title AS item_title,
                    NULL::integer AS rating, enrollment.created_at AS occurred_at
             FROM enrollments enrollment
             INNER JOIN classes class ON class.id = enrollment.class_id
             INNER JOIN users student ON student.id = enrollment.user_id
             WHERE class.merchant_id = $1 AND enrollment.deleted_at IS NULL
             UNION ALL
             SELECT 'review', reviewer.name, review.item_title, review.rating, review.created_at
             FROM (${MERCHANT_REVIEWS_SQL}) review
             INNER JOIN users reviewer ON reviewer.id = review.user_id
             UNION ALL
             SELECT 'purchase', buyer.name, sale.item_title, NULL, sale.created_at
             FROM (${MERCHANT_SALES_SQL}) sale
             INNER JOIN users buyer ON buyer.id = sale.user_id
             WHERE sale.status = 'paid' AND sale.type IN ('digital', 'bundle')
           ) activity
           ORDER BY activity.occurred_at DESC
           LIMIT 10`,
        [merchant.id],
      ),
      this.dataSource.query(
        `SELECT sale.order_id, sale.item_title, sale.amount AS price, sale.created_at AS checkout_at,
                  buyer.name AS buyer_name, buyer.email AS buyer_email, profile.phone AS buyer_phone
           FROM (${MERCHANT_SALES_SQL}) sale
           INNER JOIN users buyer ON buyer.id = sale.user_id
           LEFT JOIN user_profiles profile ON profile.user_id = buyer.id AND profile.deleted_at IS NULL
           WHERE sale.status = 'pending'
           ORDER BY sale.created_at DESC, sale.id DESC
           LIMIT 20`,
        [merchant.id],
      ),
    ]);

    return {
      data: {
        period_days: days,
        balance: Number(merchant.earning_balance ?? 0),
        storage_level: merchant.storage_level,
        lifetime_earnings: Number(merchant.lifetime_earnings ?? 0),
        revenue: periodMetric(kpi.revenue, kpi.previous_revenue),
        transactions: periodMetric(kpi.transactions, kpi.previous_transactions),
        students: periodMetric(kpi.students, kpi.previous_students),
        catalog_total: catalog.total,
        catalog_new_in_period: catalog.new_in_period,
        rating_average: rating.average === null ? null : Number(rating.average),
        review_count: rating.total,
        latest_review: latestReview
          ? { ...latestReview, rating: Number(latestReview.rating) }
          : null,
        chart: chart.map((point) => ({
          date: point.date,
          transactions: Number(point.transactions),
          revenue: Number(point.revenue),
        })),
        activities: activities.map((activity) => ({
          ...activity,
          rating: activity.rating === null ? null : Number(activity.rating),
        })),
        unpaid_transactions: unpaid.map((row) => ({
          ...row,
          price: Number(row.price),
          payment_link: null,
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
      meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
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
        FROM (${MERCHANT_SALES_SQL}) sale
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
      meta: { page, limit, total, totalPage: Math.ceil(total / limit) },
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
              sale.type, sale.item_id, sale.item_title, sale.amount,
              coupon.code AS coupon_code, sale.status
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
      amount: Number(row.amount),
      payment_method: null,
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
