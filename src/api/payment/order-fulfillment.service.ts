import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { BundleItem } from '~/api/bundle/entities/bundle-item.entity';
import { CartItem } from '~/api/cart/entities/cart-item.entity';
import { MerchantWallet } from '~/api/merchant/entities/merchant-wallet.entity';
import { OrderItem } from '~/api/order/entities/order-item.entity';
import { Order } from '~/api/order/entities/order.entity';
import { UserAccess } from '~/api/profile/entities/user-access.entity';
import { Enrollment } from '~/class/entities/enrollment.entity';

// Net income per merchant for the given orders: item price minus the item's
// code discount share. The merchant comes from the item's typed reference.
export const MERCHANT_NET_SQL = `
  SELECT COALESCE(class.merchant_id, product.merchant_id, bundle.merchant_id) AS merchant_id,
         sum(item.price_at_purchase - item.discount_amount) AS net_amount
  FROM order_items item
  LEFT JOIN classes class ON class.id = item.class_id
  LEFT JOIN products product ON product.id = item.product_id
  LEFT JOIN bundles bundle ON bundle.id = item.bundle_id
  WHERE item.order_id = ANY($1::uuid[]) AND item.deleted_at IS NULL
  GROUP BY 1
  ORDER BY 1`;

export interface MerchantAmount {
  merchantId: string;
  amount: string;
}

/**
 * Applies what a paid order produces: the buyer's access (bundles expanded
 * into their items), a cart without the bought items, and each merchant's
 * net income in its wallet. Runs inside the payment transaction, which holds
 * the order row lock, so an order is fulfilled once.
 */
@Injectable()
export class OrderFulfillmentService {
  async fulfil(manager: EntityManager, order: Order): Promise<void> {
    const items = await manager.find(OrderItem, {
      where: { orderId: order.id },
    });
    const bundleIds = ids(items.map((item) => item.bundleId));
    const bundleItems = bundleIds.length
      ? await manager.find(BundleItem, { where: { bundleId: In(bundleIds) } })
      : [];

    const classIds = ids([
      ...items.map((item) => item.classId),
      ...bundleItems.map((item) => item.classId),
    ]);
    const productIds = ids([
      ...items.map((item) => item.productId),
      ...bundleItems.map((item) => item.productId),
    ]);

    await this.grantClasses(manager, order.userId, classIds);
    await this.grantProducts(manager, order.userId, productIds);
    await this.removeFromCart(manager, order.userId, {
      classIds,
      productIds,
      bundleIds,
    });
    await creditWallets(
      manager,
      await merchantNetAmounts(manager, [order.id]),
      'earning',
    );
  }

  private async grantClasses(
    manager: EntityManager,
    userId: string,
    classIds: string[],
  ): Promise<void> {
    if (classIds.length === 0) return;
    const [{ today }] = await manager.query(
      `SELECT (now() AT TIME ZONE 'Asia/Jakarta')::date::text AS today`,
    );
    // An active enrollment already covers the class.
    await manager
      .createQueryBuilder()
      .insert()
      .into(Enrollment)
      .values(
        classIds.map((classId) => ({
          user_id: userId,
          class_id: classId,
          joinDate: today,
          created_by: userId,
        })),
      )
      .orIgnore()
      .execute();
  }

  // Access is unique per user and product; an expired or deleted grant is
  // renewed, while an active one is left untouched.
  private async grantProducts(
    manager: EntityManager,
    userId: string,
    productIds: string[],
  ): Promise<void> {
    if (productIds.length === 0) return;
    const active = await manager.query(
      `SELECT product_id FROM user_access
       WHERE user_id = $1 AND product_id = ANY($2::uuid[]) AND deleted_at IS NULL
         AND (expires_at IS NULL OR expires_at > now())`,
      [userId, productIds],
    );
    const activeIds = new Set(active.map((row) => row.product_id));
    const missing = productIds.filter((id) => !activeIds.has(id));
    if (missing.length === 0) return;

    await manager
      .createQueryBuilder()
      .insert()
      .into(UserAccess)
      .values(
        missing.map((productId) => ({
          userId,
          productId,
          grantedAt: () => 'now()',
          expiresAt: null,
        })),
      )
      .orUpdate(
        ['granted_at', 'expires_at', 'deleted_at'],
        ['user_id', 'product_id'],
      )
      .execute();
  }

  private async removeFromCart(
    manager: EntityManager,
    userId: string,
    refs: { classIds: string[]; productIds: string[]; bundleIds: string[] },
  ): Promise<void> {
    const criteria = [
      refs.classIds.length && { userId, classId: In(refs.classIds) },
      refs.productIds.length && { userId, productId: In(refs.productIds) },
      refs.bundleIds.length && { userId, bundleId: In(refs.bundleIds) },
    ].filter(Boolean);
    if (criteria.length) await manager.delete(CartItem, criteria);
  }
}

export async function merchantNetAmounts(
  manager: EntityManager,
  orderIds: string[],
): Promise<MerchantAmount[]> {
  const rows = await manager.query(MERCHANT_NET_SQL, [orderIds]);
  return rows.map((row) => ({
    merchantId: row.merchant_id,
    amount: row.net_amount,
  }));
}

/**
 * Adds amounts to merchant wallets. `earning` credits a payment (earning and
 * lifetime); `settled` makes earned income withdrawable, never beyond the
 * earning balance. Wallet rows are locked in merchant-id order so concurrent
 * multi-merchant payments cannot deadlock.
 */
export async function creditWallets(
  manager: EntityManager,
  amounts: MerchantAmount[],
  balance: 'earning' | 'settled',
): Promise<void> {
  const credits = amounts
    .filter((credit) => Number(credit.amount) > 0)
    .sort((a, b) => a.merchantId.localeCompare(b.merchantId));
  if (credits.length === 0) return;

  // Every merchant has a wallet from registration; this only covers a
  // merchant created before wallets existed.
  await manager
    .createQueryBuilder()
    .insert()
    .into(MerchantWallet)
    .values(credits.map((credit) => ({ merchantId: credit.merchantId })))
    .orIgnore()
    .execute();
  await manager.query(
    `SELECT id FROM merchant_wallets WHERE merchant_id = ANY($1::uuid[])
     ORDER BY merchant_id FOR UPDATE`,
    [credits.map((credit) => credit.merchantId)],
  );

  for (const credit of credits) {
    await manager
      .createQueryBuilder()
      .update(MerchantWallet)
      .set(
        balance === 'earning'
          ? {
              earningBalance: () => 'earning_balance + :amount',
              lifetimeEarnings: () => 'lifetime_earnings + :amount',
            }
          : {
              settledBalance: () =>
                'LEAST(settled_balance + :amount, earning_balance)',
            },
      )
      .where('merchant_id = :merchantId', { merchantId: credit.merchantId })
      .setParameter('amount', credit.amount)
      .execute();
  }
}

function ids(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))];
}
