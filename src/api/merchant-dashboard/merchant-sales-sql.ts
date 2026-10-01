// An unpaid order past its expiry reads as expired before the sweep records it.
const SALE_STATUS_SQL = `CASE WHEN purchase.status = 'pending' AND purchase.expires_at <= now()
  THEN 'expired' ELSE purchase.status END`;

// Every order item that references one of the merchant's digital products,
// classes, or bundles ($1 = merchant id). All figures derive from it; `amount`
// is the merchant's net (price minus the item's code discount share).
export const MERCHANT_SALES_SQL = `
  SELECT item.id, item.order_id, item.price_at_purchase - item.discount_amount AS amount,
         item.price_at_purchase AS gross_amount,
         ${SALE_STATUS_SQL} AS status, purchase.created_at, purchase.paid_at, purchase.user_id, purchase.coupon_id,
         purchase.expires_at, purchase.payment_url, purchase.payment_method,
         'digital' AS type, product.id AS item_id, product.title AS item_title
  FROM order_items item
  INNER JOIN products product ON product.id = item.product_id
  INNER JOIN orders purchase ON purchase.id = item.order_id
  WHERE product.merchant_id = $1 AND item.deleted_at IS NULL AND purchase.deleted_at IS NULL

  UNION ALL

  SELECT item.id, item.order_id, item.price_at_purchase - item.discount_amount,
         item.price_at_purchase,
         ${SALE_STATUS_SQL}, purchase.created_at, purchase.paid_at, purchase.user_id, purchase.coupon_id,
         purchase.expires_at, purchase.payment_url, purchase.payment_method,
         CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END,
         class.id, class.title
  FROM order_items item
  INNER JOIN classes class ON class.id = item.class_id
  INNER JOIN orders purchase ON purchase.id = item.order_id
  WHERE class.merchant_id = $1 AND item.deleted_at IS NULL AND purchase.deleted_at IS NULL

  UNION ALL

  SELECT item.id, item.order_id, item.price_at_purchase - item.discount_amount,
         item.price_at_purchase,
         ${SALE_STATUS_SQL}, purchase.created_at, purchase.paid_at, purchase.user_id, purchase.coupon_id,
         purchase.expires_at, purchase.payment_url, purchase.payment_method,
         'bundle', bundle.id, bundle.title
  FROM order_items item
  INNER JOIN bundles bundle ON bundle.id = item.bundle_id
  INNER JOIN orders purchase ON purchase.id = item.order_id
  WHERE bundle.merchant_id = $1 AND item.deleted_at IS NULL AND purchase.deleted_at IS NULL
`;

// The merchant's paid sales for analytics, dated at payment, or at order time
// for older orders paid before the payment time was recorded.
export const PAID_SALES_SQL = `
  SELECT sale.*, COALESCE(sale.paid_at, sale.created_at) AS sold_at
  FROM (${MERCHANT_SALES_SQL}) sale
  WHERE sale.status = 'paid'
`;
