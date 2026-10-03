export type SalesScope = 'merchant' | 'all';

// An unpaid order past its expiry reads as expired before the sweep records it.
const SALE_STATUS_SQL = `CASE WHEN purchase.status = 'pending' AND purchase.expires_at <= now()
  THEN 'expired' ELSE purchase.status END`;

// Every order item that references one of the merchant's digital products,
// classes, or bundles ($1 = merchant id), or every merchant's items when
// `scope` is 'all'. All figures derive from it; `amount` is the merchant's net
// (price minus the item's code discount share). `condition` is applied inside
// every branch, where the planner can use it.
function merchantSalesSql(
  condition: string,
  scope: SalesScope = 'merchant',
): string {
  const owned = (alias: string) =>
    scope === 'merchant' ? `${alias}.merchant_id = $1 AND` : '';
  return `
  SELECT item.id, item.order_id, item.price_at_purchase - item.discount_amount AS amount,
         item.price_at_purchase AS gross_amount,
         ${SALE_STATUS_SQL} AS status, purchase.created_at, purchase.paid_at, purchase.user_id, purchase.coupon_id,
         purchase.expires_at, purchase.payment_url, purchase.payment_method,
         'digital' AS type, product.id AS item_id, product.title AS item_title,
         product.merchant_id
  FROM order_items item
  INNER JOIN products product ON product.id = item.product_id
  INNER JOIN orders purchase ON purchase.id = item.order_id
  WHERE ${owned('product')} item.deleted_at IS NULL AND purchase.deleted_at IS NULL ${condition}

  UNION ALL

  SELECT item.id, item.order_id, item.price_at_purchase - item.discount_amount,
         item.price_at_purchase,
         ${SALE_STATUS_SQL}, purchase.created_at, purchase.paid_at, purchase.user_id, purchase.coupon_id,
         purchase.expires_at, purchase.payment_url, purchase.payment_method,
         CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END,
         class.id, class.title, class.merchant_id
  FROM order_items item
  INNER JOIN classes class ON class.id = item.class_id
  INNER JOIN orders purchase ON purchase.id = item.order_id
  WHERE ${owned('class')} item.deleted_at IS NULL AND purchase.deleted_at IS NULL ${condition}

  UNION ALL

  SELECT item.id, item.order_id, item.price_at_purchase - item.discount_amount,
         item.price_at_purchase,
         ${SALE_STATUS_SQL}, purchase.created_at, purchase.paid_at, purchase.user_id, purchase.coupon_id,
         purchase.expires_at, purchase.payment_url, purchase.payment_method,
         'bundle', bundle.id, bundle.title, bundle.merchant_id
  FROM order_items item
  INNER JOIN bundles bundle ON bundle.id = item.bundle_id
  INNER JOIN orders purchase ON purchase.id = item.order_id
  WHERE ${owned('bundle')} item.deleted_at IS NULL AND purchase.deleted_at IS NULL ${condition}
`;
}

export const MERCHANT_SALES_SQL = merchantSalesSql('');

// Paid sales only. Filtering the computed status outside the union hides the
// condition from the planner, which then misjudges the row count by orders of
// magnitude on large stores; a paid order's computed status is always paid.
export const MERCHANT_PAID_SALES_SQL = merchantSalesSql(
  "AND purchase.status = 'paid'",
);

// Unpaid orders still within their payment window (computed status pending).
export const MERCHANT_PENDING_SALES_SQL = merchantSalesSql(
  "AND purchase.status = 'pending' AND (purchase.expires_at IS NULL OR purchase.expires_at > now())",
);

// The merchant's paid sales for analytics, dated at payment, or at order time
// for older orders paid before the payment time was recorded.
export const PAID_SALES_SQL = `
  SELECT sale.*, COALESCE(sale.paid_at, sale.created_at) AS sold_at
  FROM (${MERCHANT_PAID_SALES_SQL}) sale
`;

// The UTC wall time at which an Asia/Jakarta date (a SQL date expression)
// starts; stored timestamps are UTC wall time.
export const jakartaDayStartUtc = (date: string) =>
  `((${date})::timestamp AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'UTC'`;

// Paid sales sold from `fromUtc` (inclusive) to `toUtc` (exclusive), two SQL
// expressions in UTC wall time. Writing the window on the payment time lets
// the planner start from the orders paid in it (idx_orders_paid_at) instead of
// a store's whole history; orders paid before payment times were recorded are
// dated at creation, as in PAID_SALES_SQL.
export function paidSalesBetweenSql(
  scope: SalesScope,
  fromUtc: string,
  toUtc: string,
): string {
  const window = `AND purchase.status = 'paid'
    AND ((purchase.paid_at >= ${fromUtc} AND purchase.paid_at < ${toUtc})
      OR (purchase.paid_at IS NULL AND purchase.created_at >= ${fromUtc} AND purchase.created_at < ${toUtc}))`;
  return `
  SELECT sale.*, COALESCE(sale.paid_at, sale.created_at) AS sold_at
  FROM (${merchantSalesSql(window, scope)}) sale
`;
}
