import { EntityManager, IsNull } from 'typeorm';
import { DiscountCode } from '~/api/discount/entities/discount-code.entity';
import { Order } from '~/api/order/entities/order.entity';
import { CouponUsage } from '~/api/voucher/entities/coupon-usage.entity';

/**
 * Releases an order's voucher usage and discount-code use. Callers run this
 * once, in the same transaction as the order's move out of `pending`.
 */
export async function releaseOrderCodes(
  manager: EntityManager,
  order: Pick<Order, 'id' | 'couponId' | 'discountCodeId'>,
): Promise<void> {
  if (order.couponId) {
    await manager.softDelete(CouponUsage, {
      orderId: order.id,
      deleted_at: IsNull(),
    });
  }
  if (order.discountCodeId) {
    await manager
      .createQueryBuilder()
      .update(DiscountCode)
      .set({ usedCount: () => 'used_count - 1' })
      .where('id = :id AND used_count > 0', { id: order.discountCodeId })
      .execute();
  }
}

/**
 * Restores the codes of a released order that was paid after all. A code
 * whose limit was reached by others meanwhile is not recounted: the paid
 * buyer keeps the discount either way.
 */
export async function reclaimOrderCodes(
  manager: EntityManager,
  order: Pick<Order, 'id' | 'userId' | 'couponId' | 'discountCodeId'>,
): Promise<void> {
  if (order.couponId) {
    const [voucher] = await manager.query(
      `SELECT coupon.max_uses,
              (SELECT count(*)::integer FROM coupon_usages usage
               WHERE usage.coupon_id = coupon.id AND usage.deleted_at IS NULL) AS used
       FROM coupons coupon WHERE coupon.id = $1
       FOR UPDATE`,
      [order.couponId],
    );
    if (
      voucher &&
      (voucher.max_uses === null || voucher.used < voucher.max_uses)
    ) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(CouponUsage)
        .values({
          couponId: order.couponId,
          userId: order.userId,
          orderId: order.id,
        })
        .orIgnore()
        .execute();
    }
  }
  if (order.discountCodeId) {
    await manager
      .createQueryBuilder()
      .update(DiscountCode)
      .set({ usedCount: () => 'used_count + 1' })
      .where('id = :id AND used_count < usage_limit', {
        id: order.discountCodeId,
      })
      .execute();
  }
}
