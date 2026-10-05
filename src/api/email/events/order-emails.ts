import { EntityManager } from 'typeorm';
import { EmailToQueue, guardEmailQueue, queueEmails } from '../email-queue';
import type { EmailLine, ItemType } from '../templates/layout';

interface OrderRow {
  id: string;
  order_number: string;
  total_amount: string;
  discount_amount: string;
  payment_url: string | null;
  payment_method: string | null;
  settlement_date: string | null;
  expires_at: Date | null;
  paid_at: Date | null;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string;
}

interface OrderLineRow {
  type: ItemType;
  title: string;
  instructions: string | null;
  price: string;
  discount: string;
  merchant_id: string | null;
  store_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  email_new_sale: boolean;
}

interface OrderEmailData {
  order: OrderRow;
  lines: OrderLineRow[];
}

// Timestamps are stored as UTC without a zone.
async function loadOrder(
  manager: EntityManager,
  orderId: string,
): Promise<OrderEmailData | null> {
  const [order]: OrderRow[] = await manager.query(
    `SELECT o.id, o.order_number, o.total_amount, o.discount_amount, o.payment_url,
            o.payment_method, o.settlement_date::text AS settlement_date,
            o.expires_at AT TIME ZONE 'UTC' AS expires_at,
            o.paid_at AT TIME ZONE 'UTC' AS paid_at,
            buyer.id AS buyer_id, buyer.name AS buyer_name, buyer.email AS buyer_email
     FROM orders o
     INNER JOIN users buyer ON buyer.id = o.user_id
     WHERE o.id = $1`,
    [orderId],
  );
  if (!order) return null;
  const lines: OrderLineRow[] = await manager.query(
    `SELECT CASE WHEN item.bundle_id IS NOT NULL THEN 'bundle'
                 WHEN item.product_id IS NOT NULL THEN 'digital'
                 WHEN class.type = 'live-bootcamp' THEN 'bootcamp'
                 ELSE 'kelas' END AS type,
            COALESCE(bundle.title, product.title, class.title) AS title,
            NULLIF(btrim(COALESCE(bundle.post_purchase_instructions,
              product.post_purchase_instructions, class.post_purchase_instructions)), '') AS instructions,
            item.price_at_purchase AS price, item.discount_amount AS discount,
            merchant.id AS merchant_id, merchant.store_name,
            owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email,
            COALESCE(preference.email_new_sale, true) AS email_new_sale
     FROM order_items item
     LEFT JOIN bundles bundle ON bundle.id = item.bundle_id
     LEFT JOIN products product ON product.id = item.product_id
     LEFT JOIN classes class ON class.id = item.class_id
     LEFT JOIN merchants merchant
       ON merchant.id = COALESCE(bundle.merchant_id, product.merchant_id, class.merchant_id)
     LEFT JOIN users owner ON owner.id = merchant.user_id AND owner.deleted_at IS NULL
     LEFT JOIN user_notification_preferences preference ON preference.user_id = owner.id
     WHERE item.order_id = $1 AND item.deleted_at IS NULL
     ORDER BY item.created_at, item.id`,
    [orderId],
  );
  return { order, lines };
}

function buyerLines(lines: OrderLineRow[]): EmailLine[] {
  return lines.map((line) => ({
    title: line.title,
    type: line.type,
    merchant: line.store_name ?? undefined,
    amount: Number(line.price),
    instructions: line.instructions,
  }));
}

function orderSummary({ order, lines }: OrderEmailData) {
  return {
    order_number: order.order_number,
    buyer_name: order.buyer_name,
    items: buyerLines(lines),
    discount_amount: Number(order.discount_amount),
    total_amount: Number(order.total_amount),
  };
}

/** Called once the order's Duitku invoice exists. */
export async function queueOrderAwaitingPaymentEmail(
  manager: EntityManager,
  orderId: string,
): Promise<void> {
  await guardEmailQueue(manager, 'order awaiting payment', async (manager) => {
    const data = await loadOrder(manager, orderId);
    if (!data?.order.payment_url || !data.order.expires_at) return;
    const { order } = data;
    await queueEmails(manager, [
      {
        kind: 'order_awaiting_payment',
        to: order.buyer_email,
        userId: order.buyer_id,
        dedupeKey: `order:${order.id}:awaiting`,
        payload: {
          ...orderSummary(data),
          expires_at: new Date(order.expires_at).toISOString(),
          payment_url: order.payment_url,
        },
        expiresAt: new Date(order.expires_at),
      },
    ]);
  });
}

/**
 * The buyer's receipt with each item's instructions, and one new-sale email
 * per merchant in the order whose owner has `email_new_sale` on.
 */
export async function queueOrderPaidEmails(
  manager: EntityManager,
  orderId: string,
): Promise<void> {
  await guardEmailQueue(manager, 'order paid', async (manager) => {
    const data = await loadOrder(manager, orderId);
    if (!data) return;
    const { order, lines } = data;
    const paidAt = new Date(order.paid_at ?? Date.now()).toISOString();
    const emails: EmailToQueue[] = [
      {
        kind: 'order_paid',
        to: order.buyer_email,
        userId: order.buyer_id,
        dedupeKey: `order:${order.id}:paid`,
        payload: {
          ...orderSummary(data),
          paid_at: paidAt,
          payment_method: order.payment_method,
        },
      },
    ];

    const merchants = new Map<string, OrderLineRow[]>();
    for (const line of lines) {
      if (!line.merchant_id || !line.owner_email || !line.email_new_sale) {
        continue;
      }
      merchants.set(line.merchant_id, [
        ...(merchants.get(line.merchant_id) ?? []),
        line,
      ]);
    }
    for (const [merchantId, merchantLines] of merchants) {
      const [first] = merchantLines;
      const items: EmailLine[] = merchantLines.map((line) => ({
        title: line.title,
        type: line.type,
        amount: Number(line.price) - Number(line.discount),
      }));
      emails.push({
        kind: 'merchant_new_sale',
        to: first.owner_email as string,
        userId: first.owner_id,
        dedupeKey: `order:${order.id}:sale:${merchantId}`,
        payload: {
          order_number: order.order_number,
          buyer_name: order.buyer_name,
          owner_name: first.owner_name ?? first.store_name ?? '',
          store_name: first.store_name ?? '',
          paid_at: paidAt,
          items,
          net_total: items.reduce((sum, item) => sum + item.amount, 0),
          settlement_date: order.settlement_date,
        },
      });
    }
    await queueEmails(manager, emails);
  });
}

/** Called when an unpaid order expires or Duitku reports a failure. */
export async function queueOrderClosedEmail(
  manager: EntityManager,
  orderId: string,
  outcome: 'expired' | 'failed',
): Promise<void> {
  await guardEmailQueue(manager, `order ${outcome}`, async (manager) => {
    const data = await loadOrder(manager, orderId);
    if (!data) return;
    await queueEmails(manager, [
      {
        kind: outcome === 'expired' ? 'order_expired' : 'order_failed',
        to: data.order.buyer_email,
        userId: data.order.buyer_id,
        dedupeKey: `order:${data.order.id}:${outcome}`,
        payload: orderSummary(data),
      },
    ]);
  });
}
