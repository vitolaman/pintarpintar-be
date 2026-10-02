import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DiscountCodeType } from '~/api/discount/entities/discount-code.entity';
import {
  CatalogItemColumns,
  findOwnedItemIds,
  loadCatalogItems,
  resolveItemReferences,
} from '~/common/catalog/catalog-item';
import { CheckoutRequestDto } from '../dto/checkout.dto';
import {
  CodeRejectedException,
  CodeRejectionReason,
  DiscountCodeRule,
  PricingItem,
  PricingResult,
  PromoCodeRule,
  VoucherRule,
  assertCodeApplies,
  priceSelection,
} from './checkout-pricing';

export interface RejectedCode {
  code: string;
  reason: CodeRejectionReason;
}

export interface CheckoutQuote {
  pricing: PricingResult;
  references: CatalogItemColumns[];
  voucher: VoucherRule | null;
  discountCode: DiscountCodeRule | null;
  // Always empty unless the quote is lenient.
  rejectedCodes: RejectedCode[];
}

// Whether a code can be used now, from its own and its merchant's state.
interface CodeAvailability {
  is_active: boolean;
  not_started: boolean;
  has_ended: boolean;
}

interface VoucherRow extends CodeAvailability {
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
}

interface DiscountCodeRow extends CodeAvailability {
  id: string;
  code: string;
  usage_limit: number;
  used_count: number;
  code_type: DiscountCodeType;
  discount_id: string;
  merchant_id: string;
  merchant_name: string | null;
  discount_type: 'percentage' | 'nominal';
  discount_value: string;
  minimum_purchase: string | null;
}

/**
 * Validates a checkout selection and its codes against live data and prices
 * it. Checkout calls it with `lockCodes` inside its transaction, so the
 * reserved codes cannot be taken by a concurrent checkout meanwhile.
 *
 * A `lenient` quote (preview) prices the selection without the codes that
 * cannot be used and lists them in `rejectedCodes`. Errors of the request
 * itself (a code entered twice, two codes of one kind, item errors) are
 * still thrown.
 */
@Injectable()
export class CheckoutQuoteService {
  async quote(
    manager: EntityManager,
    userId: string,
    request: CheckoutRequestDto,
    options: { lockCodes: boolean; lenient?: boolean },
  ): Promise<CheckoutQuote> {
    const references = await resolveItemReferences(manager, request.items);
    const items = await this.loadItems(manager, userId, request, references);
    const rejectedCodes: RejectedCode[] = [];
    const rejected = options.lenient ? rejectedCodes : null;
    const loaded = await this.loadCodes(
      manager,
      userId,
      request.codes ?? [],
      options.lockCodes,
      rejected,
    );
    const rules = rejected
      ? loaded.filter((rule) => {
          try {
            assertCodeApplies(items, rule);
            return true;
          } catch (error) {
            if (recordRejection(error, rejected)) return false;
            throw error;
          }
        })
      : loaded;

    return {
      pricing: priceSelection(items, rules),
      references,
      voucher: (rules.find((rule) => rule.kind === 'voucher') ??
        null) as VoucherRule | null,
      discountCode: (rules.find((rule) => rule.kind === 'discount') ??
        null) as DiscountCodeRule | null,
      rejectedCodes,
    };
  }

  private async loadItems(
    manager: EntityManager,
    userId: string,
    request: CheckoutRequestDto,
    references: CatalogItemColumns[],
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

    const [details, owned] = await Promise.all([
      loadCatalogItems(manager, references),
      findOwnedItemIds(manager, userId, references),
    ]);

    return request.items.map((ref) => {
      const item = details.get(ref.id);
      if (!item || !item.is_available) {
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
    rejected: RejectedCode[] | null,
  ): Promise<PromoCodeRule[]> {
    // Sorted, so concurrent checkouts lock the same code rows in one order.
    const codes = enteredCodes.map((code) => code.trim().toUpperCase()).sort();
    if (new Set(codes).size !== codes.length) {
      throw new BadRequestException('A code is entered more than once');
    }

    const rules: PromoCodeRule[] = [];
    for (const code of codes) {
      let rule: PromoCodeRule;
      try {
        rule =
          (await this.loadVoucher(manager, code, lockCodes)) ??
          (await this.loadDiscountCode(manager, userId, code, lockCodes));
        if (!rule) {
          throw new CodeRejectedException(
            code,
            'not_found',
            `Code ${code} is invalid or expired`,
          );
        }
      } catch (error) {
        if (recordRejection(error, rejected)) continue;
        throw error;
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
              coupon.is_active AND merchant.status = 'active'
                AND merchant.deleted_at IS NULL AS is_active,
              coupon.starts_at IS NOT NULL AND coupon.starts_at > now() AS not_started,
              coupon.expires_at IS NOT NULL AND coupon.expires_at <= now() AS has_ended
       FROM coupons coupon
       INNER JOIN merchants merchant ON merchant.id = coupon.merchant_id
       WHERE upper(coupon.code) = $1 AND coupon.deleted_at IS NULL`,
      [code],
    );
    if (!row) return null;
    assertAvailable(code, row);
    if (row.max_uses !== null && row.used >= row.max_uses) {
      throw usedUp(code);
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
      `SELECT code.id, upper(code.code) AS code,
              code.usage_limit, code.used_count, code.code_type, discount.id AS discount_id,
              discount.merchant_id, merchant.store_name AS merchant_name,
              discount.discount_type, discount.discount_value, discount.minimum_purchase,
              discount.is_active AND merchant.status = 'active'
                AND merchant.deleted_at IS NULL AS is_active,
              discount.starts_at IS NOT NULL AND discount.starts_at > now() AS not_started,
              discount.ends_at IS NOT NULL AND discount.ends_at <= now() AS has_ended
       FROM discount_codes code
       INNER JOIN discounts discount
         ON discount.id = code.discount_id AND discount.deleted_at IS NULL
       INNER JOIN merchants merchant ON merchant.id = discount.merchant_id
       WHERE upper(code.code) = $1 AND code.deleted_at IS NULL
       ${lock ? 'FOR UPDATE OF code' : ''}`,
      [code],
    );
    if (!row) return null;
    assertAvailable(code, row);
    if (row.used_count >= row.usage_limit) {
      throw usedUp(code);
    }
    // A recurring code ("Kode Berulang") is shared by many users but usable
    // once per user. Released orders (expired, failed, cancelled) do not
    // count; checkout holds the code row lock, so concurrent checkouts of one
    // user see each other's pending order.
    if (row.code_type === 'recurring') {
      const [used] = await manager.query(
        `SELECT 1 FROM orders
         WHERE discount_code_id = $1 AND user_id = $2 AND deleted_at IS NULL
           AND (status = 'paid' OR (status = 'pending' AND expires_at > now()))
         LIMIT 1`,
        [row.id, userId],
      );
      if (used) {
        throw new CodeRejectedException(
          code,
          'already_used',
          `You have already used code ${code}`,
        );
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

// A deactivated code, or one of an inactive merchant, reads as expired to
// the buyer; the message stays the same for every unavailable code.
function assertAvailable(code: string, row: CodeAvailability): void {
  let reason: CodeRejectionReason | null = null;
  if (!row.is_active || row.has_ended) {
    reason = 'expired';
  } else if (row.not_started) {
    reason = 'not_started';
  }
  if (reason) {
    throw new CodeRejectedException(
      code,
      reason,
      `Code ${code} is invalid or expired`,
    );
  }
}

function usedUp(code: string): CodeRejectedException {
  return new CodeRejectedException(
    code,
    'used_up',
    `Code ${code} has reached its usage limit`,
  );
}

// Records a code rejection when collecting them; false means rethrow.
function recordRejection(
  error: unknown,
  rejected: RejectedCode[] | null,
): boolean {
  if (!rejected || !(error instanceof CodeRejectedException)) return false;
  rejected.push({ code: error.promoCode, reason: error.reason });
  return true;
}

function numberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}
