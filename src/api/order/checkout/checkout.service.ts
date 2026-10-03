import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DiscountCode } from '~/api/discount/entities/discount-code.entity';
import { DuitkuClient } from '~/api/payment/duitku/duitku.client';
import {
  OrderPaymentService,
  jakartaDate,
} from '~/api/payment/order-payment.service';
import {
  MINIMUM_PAYMENT_AMOUNT,
  PAYMENT_EXPIRY_MINUTES,
} from '~/api/payment/payment.constants';
import { User } from '~/api/user/entities/user.entity';
import { CouponUsage } from '~/api/voucher/entities/coupon-usage.entity';
import { CatalogItemColumns } from '~/common/catalog/catalog-item';
import {
  CheckoutPreviewResponseDto,
  CheckoutRequestDto,
} from '../dto/checkout.dto';
import { OrderItem } from '../entities/order-item.entity';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderService } from '../order.service';
import { PricingResult } from './checkout-pricing';
import { CheckoutQuoteService, RejectedCode } from './checkout-quote.service';

@Injectable()
export class CheckoutService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly quotes: CheckoutQuoteService,
    private readonly duitku: DuitkuClient,
    private readonly payments: OrderPaymentService,
    private readonly orders: OrderService,
  ) {}

  // Lenient: codes that cannot be used are left out of the price and listed
  // in `rejected_codes`; checkout still rejects them.
  async preview(userId: string, request: CheckoutRequestDto) {
    const { pricing, rejectedCodes } = await this.quotes.quote(
      this.dataSource.manager,
      userId,
      request,
      { lockCodes: false, lenient: true },
    );
    return {
      data: toPreview(pricing, rejectedCodes),
      responseMessage: 'Preview checkout success',
    };
  }

  /**
   * Creates one pending order with its codes reserved, then opens the Duitku
   * invoice outside the transaction. A Rp0 order is paid at once without the
   * gateway. If the invoice cannot be created, the order fails and releases
   * its codes.
   */
  async checkout(userId: string, request: CheckoutRequestDto) {
    const user = await this.dataSource.manager.findOneByOrFail(User, {
      id: userId,
    });
    const { order, pricing } = await this.dataSource.transaction((manager) =>
      this.createOrder(manager, userId, request),
    );

    if (order.status === OrderStatus.PENDING) {
      try {
        const invoice = await this.duitku.createInvoice({
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: pricing.total,
          productDetails: `Pintar Pintar ${order.orderNumber}: ${pricing.items
            .map((item) => item.title)
            .join(', ')}`,
          email: user.email,
          customerName: user.name,
          items: pricing.items
            .map((item) => ({
              name: item.title,
              price: item.price - item.discountAmount,
            }))
            .filter((item) => item.price > 0),
        });
        await this.dataSource.manager.update(
          Order,
          { id: order.id },
          {
            paymentGatewayRef: invoice.reference,
            paymentUrl: invoice.paymentUrl,
          },
        );
      } catch (error) {
        await this.payments.failPending(order.id);
        throw error;
      }
    }

    return {
      data: await this.orders.findDetail(userId, order.id),
      responseMessage: 'Checkout success',
    };
  }

  cancel(userId: string, orderId: string): Promise<void> {
    return this.payments.cancel(userId, orderId);
  }

  /**
   * Asks Duitku for the status of the buyer's unpaid order, recovering a
   * missed callback. A success is applied exactly like a verified callback;
   * pending and failed results leave the order unchanged.
   */
  async checkPayment(userId: string, orderId: string) {
    const order = await this.orders.findDetail(userId, orderId);
    if (order.status !== OrderStatus.PAID) {
      const invoiced = await this.dataSource.manager.findOneBy(Order, {
        id: orderId,
      });
      if (invoiced.paymentGatewayRef) {
        const status = await this.duitku.checkStatus(order.order_number);
        if (status.statusCode === '00') {
          await this.payments.applyGatewayResult({
            orderNumber: order.order_number,
            resultCode: '00',
            amount: status.amount ?? String(order.total_amount),
            reference: status.reference,
            paymentMethod: null,
            settlementDate: null,
          });
        }
      }
    }
    return {
      data: await this.orders.findDetail(userId, orderId),
      responseMessage: 'Check payment success',
    };
  }

  private async createOrder(
    manager: EntityManager,
    userId: string,
    request: CheckoutRequestDto,
  ): Promise<{ order: Order; pricing: PricingResult }> {
    // One checkout per buyer at a time, so two quick submissions cannot
    // both pass the "already awaiting payment" check.
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `checkout:${userId}`,
    ]);
    const quote = await this.quotes.quote(manager, userId, request, {
      lockCodes: true,
    });
    const { pricing } = quote;
    await assertNotAwaitingPayment(manager, userId, quote.references);

    if (pricing.total > 0 && pricing.total < MINIMUM_PAYMENT_AMOUNT) {
      throw new BadRequestException(
        `The minimum payment is Rp${MINIMUM_PAYMENT_AMOUNT}`,
      );
    }
    if (pricing.total > 0) this.duitku.requireConfig();

    const orderNumber = await nextOrderNumber(manager);
    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(Order)
      .values({
        userId,
        orderNumber,
        couponId: quote.voucher?.id ?? null,
        discountCodeId: quote.discountCode?.id ?? null,
        totalAmount: String(pricing.total),
        discountAmount: String(pricing.discountTotal),
        status: OrderStatus.PENDING,
        expiresAt: () => `now() + interval '${PAYMENT_EXPIRY_MINUTES} minutes'`,
      })
      .execute();
    const orderId: string = inserted.identifiers[0].id;

    await manager.insert(
      OrderItem,
      pricing.items.map((item, index) => ({
        orderId,
        ...quote.references[index],
        priceAtPurchase: String(item.price),
        discountAmount: String(item.discountAmount),
      })),
    );

    if (quote.voucher) {
      await manager.insert(CouponUsage, {
        couponId: quote.voucher.id,
        userId,
        orderId,
      });
    }
    if (quote.discountCode) {
      const reserved = await manager
        .createQueryBuilder()
        .update(DiscountCode)
        .set({ usedCount: () => 'used_count + 1' })
        .where('id = :id AND used_count < usage_limit', {
          id: quote.discountCode.id,
        })
        .execute();
      if (!reserved.affected) {
        throw new BadRequestException(
          `Code ${quote.discountCode.code} has reached its usage limit`,
        );
      }
    }

    const order = await manager.findOneByOrFail(Order, { id: orderId });
    if (pricing.total === 0) {
      await this.payments.markPaid(manager, order, {
        reference: null,
        paymentMethod: null,
        settlementDate: await jakartaDate(manager),
      });
    }
    return { order, pricing };
  }
}

async function assertNotAwaitingPayment(
  manager: EntityManager,
  userId: string,
  references: CatalogItemColumns[],
): Promise<void> {
  const [pending] = await manager.query(
    `SELECT purchase.id, COALESCE(item.class_id, item.product_id, item.bundle_id) AS item_id
     FROM orders purchase
     INNER JOIN order_items item ON item.order_id = purchase.id AND item.deleted_at IS NULL
     WHERE purchase.user_id = $1 AND purchase.status = 'pending'
       AND purchase.expires_at > now() AND purchase.deleted_at IS NULL
       AND (item.class_id = ANY($2::uuid[]) OR item.product_id = ANY($3::uuid[])
            OR item.bundle_id = ANY($4::uuid[]))
     LIMIT 1`,
    [
      userId,
      references.map((ref) => ref.classId).filter(Boolean),
      references.map((ref) => ref.productId).filter(Boolean),
      references.map((ref) => ref.bundleId).filter(Boolean),
    ],
  );
  if (pending) {
    throw new ConflictException({
      message: `Item ${pending.item_id} is awaiting payment in order ${pending.id}`,
      details: { order_id: pending.id },
    });
  }
}

// `ORD-YYYYMMDD-NNNN` on the Asia/Jakarta date. The per-day lock is held
// until the checkout commits, so numbers are sequential and never reused.
async function nextOrderNumber(manager: EntityManager): Promise<string> {
  const day = (await jakartaDate(manager)).replace(/-/g, '');
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `order-number:${day}`,
  ]);
  const [{ last }] = await manager.query(
    `SELECT max(substring(order_number FROM 14)::integer) AS last
     FROM orders WHERE order_number LIKE $1`,
    [`ORD-${day}-%`],
  );
  return `ORD-${day}-${String((last ?? 0) + 1).padStart(4, '0')}`;
}

function toPreview(
  pricing: PricingResult,
  rejectedCodes: RejectedCode[],
): CheckoutPreviewResponseDto {
  return {
    items: pricing.items.map((item) => ({
      type: item.type,
      item_id: item.id,
      title: item.title,
      image_url: item.imageUrl,
      merchant_id: item.merchantId,
      merchant_name: item.merchantName,
      price: item.price,
      discount_amount: item.discountAmount,
    })),
    codes: pricing.codes.map((code) => ({
      kind: code.kind,
      code: code.code,
      merchant_id: code.merchantId,
      merchant_name: code.merchantName,
      discount_amount: code.discountAmount,
    })),
    rejected_codes: rejectedCodes.map(({ code, reason }) => ({
      code,
      reason,
    })),
    subtotal: pricing.subtotal,
    discount_amount: pricing.discountTotal,
    total_amount: pricing.total,
  };
}
