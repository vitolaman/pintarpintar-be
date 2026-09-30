import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  CatalogItemColumns,
  findOwnedItemIds,
  loadCatalogItems,
  toReferenceColumns,
} from '~/common/catalog/catalog-item';
import { CheckoutRequestDto } from '../dto/checkout.dto';
import {
  DiscountCodeRule,
  PricingItem,
  PricingResult,
  PromoCodeRule,
  VoucherRule,
  priceSelection,
} from './checkout-pricing';

export interface CheckoutQuote {
  pricing: PricingResult;
  references: CatalogItemColumns[];
  voucher: VoucherRule | null;
  discountCode: DiscountCodeRule | null;
}

interface VoucherRow {
  id: string;
  code: string;
  merchant_id: string;
  merchant_name: string | null;
  discount_type: 'percentage' | 'nominal';
  discount_value: string;
  minimum_order_amount: string | null;
  maximum_discount_amount: string | null;
  max_uses: number | null;
  used: number;
  is_usable: boolean;
}

interface DiscountCodeRow {
  id: string;
  code: string;
  code_type: 'once' | 'recurring';
  usage_limit: number;
  used_count: number;
  discount_id: string;
  merchant_id: string;
  merchant_name: string | null;
  discount_type: 'percentage' | 'nominal';
  discount_value: string;
  minimum_purchase: string | null;
  is_usable: boolean;
}

/**
 * Validates a checkout selection and its codes against live data and prices
 * it. Checkout calls it with `lockCodes` inside its transaction, so the
 * reserved codes cannot be taken by a concurrent checkout meanwhile.
 */
@Injectable()
export class CheckoutQuoteService {
  async quote(
    manager: EntityManager,
    userId: string,
    request: CheckoutRequestDto,
    options: { lockCodes: boolean },
  ): Promise<CheckoutQuote> {
    const items = await this.loadItems(manager, userId, request);
    const rules = await this.loadCodes(
      manager,
      userId,
      request.codes ?? [],
      options.lockCodes,
    );

    return {
      pricing: priceSelection(items, rules),
      references: request.items.map(toReferenceColumns),
      voucher: (rules.find((rule) => rule.kind === 'voucher') ??
        null) as VoucherRule | null,
      discountCode: (rules.find((rule) => rule.kind === 'discount') ??
        null) as DiscountCodeRule | null,
    };
  }

  private async loadItems(
    manager: EntityManager,
    userId: string,
    request: CheckoutRequestDto,
  ): Promise<PricingItem[]> {
    const seen = new Set<string>();
    for (const ref of request.items) {
      if (seen.has(ref.id)) {
        throw new BadRequestException(
          `Item ${ref.id} is selected more than once`,
        );
      }
      seen.add(ref.id);
    }

    const references = request.items.map(toReferenceColumns);
    const [details, owned] = await Promise.all([
      loadCatalogItems(manager, references),
      findOwnedItemIds(manager, userId, references),
    ]);

    return request.items.map((ref) => {
      const item = details.get(ref.id);
      if (!item || item.type !== ref.type) {
        throw new BadRequestException(`Item ${ref.id} is not a ${ref.type}`);
      }
      if (!item.is_available) {
        throw new BadRequestException(`Item ${ref.id} is not available`);
      }
      if (owned.has(ref.id)) {
        throw new BadRequestException(`You already own item ${ref.id}`);
      }
      return {
        type: item.type,
        id: item.id,
        title: item.title,
        image: item.image,
        merchantId: item.merchant_id,
        merchantName: item.merchant_name,
        price: item.price,
      };
    });
  }

  private async loadCodes(
    manager: EntityManager,
    userId: string,
    enteredCodes: string[],
    lockCodes: boolean,
  ): Promise<PromoCodeRule[]> {
    // Sorted, so concurrent checkouts lock the same code rows in one order.
    const codes = enteredCodes.map((code) => code.trim().toUpperCase()).sort();
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('A code is entered more than once');
    }

    const rules: PromoCodeRule[] = [];
    for (const code of codes) {
      const rule =
        (await this.loadVoucher(manager, code, lockCodes)) ??
        (await this.loadDiscountCode(manager, userId, code, lockCodes));
      if (!rule) {
        throw new BadRequestException(`Code ${code} is invalid or expired`);
      }
      if (rules.some((existing) => existing.kind === rule.kind)) {
        throw new BadRequestException(
          'Only one voucher and one discount code can be used',
        );
      }
      rules.push(rule);
    }
    return rules;
  }

  private async loadVoucher(
    manager: EntityManager,
    code: string,
    lock: boolean,
  ): Promise<VoucherRule | null> {
    // Locked in its own statement, so the usage count below is read after
    // any concurrent reservation has committed.
    if (lock) {
      await manager.query(
        `SELECT id FROM coupons
         WHERE upper(code) = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [code],
      );
    }
    const [row]: VoucherRow[] = await manager.query(
      `SELECT coupon.id, upper(coupon.code) AS code, coupon.merchant_id,
              merchant.store_name AS merchant_name,
              coupon.discount_type, coupon.discount_value,
              coupon.minimum_order_amount, coupon.maximum_discount_amount,
              coupon.max_uses,
              (SELECT count(*)::integer FROM coupon_usages usage
               WHERE usage.coupon_id = coupon.id AND usage.deleted_at IS NULL) AS used,
              coupon.is_active
                AND (coupon.starts_at IS NULL OR coupon.starts_at <= now())
                AND (coupon.expires_at IS NULL OR coupon.expires_at > now())
                AND merchant.status = 'active' AND merchant.deleted_at IS NULL AS is_usable
       FROM coupons coupon
       INNER JOIN merchants merchant ON merchant.id = coupon.merchant_id
       WHERE upper(coupon.code) = $1 AND coupon.deleted_at IS NULL`,
      [code],
    );
    if (!row) return null;
    if (!row.is_usable) {
      throw new BadRequestException(`Code ${code} is invalid or expired`);
    }
    if (row.max_uses !== null && row.used >= row.max_uses) {
      throw new BadRequestException(`Code ${code} has reached its usage limit`);
    }

    return {
      kind: 'voucher',
      id: row.id,
      code: row.code,
      merchantId: row.merchant_id,
      merchantName: row.merchant_name,
      discountType: row.discount_type,
      value: Number(row.discount_value),
      minimumPurchase: numberOrNull(row.minimum_order_amount),
      maximumDiscount: numberOrNull(row.maximum_discount_amount),
    };
  }

  private async loadDiscountCode(
    manager: EntityManager,
    userId: string,
    code: string,
    lock: boolean,
  ): Promise<DiscountCodeRule | null> {
    const [row]: DiscountCodeRow[] = await manager.query(
      `SELECT code.id, upper(code.code) AS code, code.code_type,
              code.usage_limit, code.used_count, discount.id AS discount_id,
              discount.merchant_id, merchant.store_name AS merchant_name,
              discount.discount_type, discount.discount_value, discount.minimum_purchase,
              discount.is_active
                AND (discount.starts_at IS NULL OR discount.starts_at <= now())
                AND (discount.ends_at IS NULL OR discount.ends_at > now())
                AND merchant.status = 'active' AND merchant.deleted_at IS NULL AS is_usable
       FROM discount_codes code
       INNER JOIN discounts discount
         ON discount.id = code.discount_id AND discount.deleted_at IS NULL
       INNER JOIN merchants merchant ON merchant.id = discount.merchant_id
       WHERE upper(code.code) = $1 AND code.deleted_at IS NULL
       ${lock ? 'FOR UPDATE OF code' : ''}`,
      [code],
    );
    if (!row) return null;
    if (!row.is_usable) {
      throw new BadRequestException(`Code ${code} is invalid or expired`);
    }
    if (row.used_count >= row.usage_limit) {
      throw new BadRequestException(`Code ${code} has reached its usage limit`);
    }
    if (row.code_type === 'once') {
      const [{ used }] = await manager.query(
        `SELECT EXISTS (
           SELECT 1 FROM orders
           WHERE user_id = $1 AND discount_code_id = $2 AND deleted_at IS NULL
             AND (status = 'paid' OR (status = 'pending' AND expires_at > now()))
         ) AS used`,
        [userId, row.id],
      );
      if (used) {
        throw new BadRequestException(`Code ${code} has already been used`);
      }
    }

    const targets: Array<{
      class_id: string | null;
      product_id: string | null;
    }> = await manager.query(
      `SELECT class_id, product_id FROM discount_products
         WHERE discount_id = $1 AND deleted_at IS NULL`,
      [row.discount_id],
    );

    return {
      kind: 'discount',
      id: row.id,
      code: row.code,
      merchantId: row.merchant_id,
      merchantName: row.merchant_name,
      discountType: row.discount_type,
      value: Number(row.discount_value),
      minimumPurchase: numberOrNull(row.minimum_purchase),
      targets:
        targets.length === 0
          ? null
          : {
              classIds: new Set(
                targets.map((target) => target.class_id).filter(Boolean),
              ),
              productIds: new Set(
                targets.map((target) => target.product_id).filter(Boolean),
              ),
            },
    };
  }
}

function numberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}
