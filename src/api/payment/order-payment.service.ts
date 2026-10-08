import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Order, OrderStatus } from '~/api/order/entities/order.entity';
import { reclaimOrderCodes, releaseOrderCodes } from './order-codes';
import {
  OrderFulfillmentService,
  creditWallets,
  merchantNetAmounts,
} from './order-fulfillment.service';
import { SETTLEMENT_FALLBACK_DAYS } from './payment.constants';
import { queueBalanceSettledEmails } from '~/api/email/events/merchant-emails';
import {
  queueOrderClosedEmail,
  queueOrderPaidEmails,
} from '~/api/email/events/order-emails';

const EXPIRY_BATCH_SIZE = 500;
const SETTLEMENT_BATCH_SIZE = 200;
const SETTLEMENT_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface GatewayResult {
  orderNumber: string;
  // `00` means paid; any other result code is a failure.
  resultCode: string;
  // Paid amount as reported by the gateway.
  amount: string;
  reference: string | null;
  paymentMethod: string | null;
  // `YYYY-MM-DD` estimated by Duitku.
  settlementDate: string | null;
}

export type GatewayOutcome = 'paid' | 'failed' | 'unchanged';

/**
 * Owns every order status change after checkout: payment, failure,
 * cancellation, expiry, and settlement. Each change locks the order row,
 * so retried or concurrent notifications apply once.
 */
@Injectable()
export class OrderPaymentService {
  private readonly logger = new Logger(OrderPaymentService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly fulfillment: OrderFulfillmentService,
  ) {}

  async applyGatewayResult(result: GatewayResult): Promise<GatewayOutcome> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { orderNumber: result.orderNumber },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (Number(result.amount) !== Number(order.totalAmount)) {
        throw new BadRequestException('Amount does not match the order');
      }
      if (order.status === OrderStatus.PAID) return 'unchanged';

      if (result.resultCode === '00') {
        await this.markPaid(manager, order, result);
        this.logger.log(`Order ${order.orderNumber} paid`);
        return 'paid';
      }
      if (order.status === OrderStatus.PENDING) {
        await this.close(manager, order, OrderStatus.FAILED);
        await queueOrderClosedEmail(manager, order.id, 'failed');
        this.logger.log(
          `Order ${order.orderNumber} failed with result ${result.resultCode}`,
        );
        return 'failed';
      }
      return 'unchanged';
    });
  }

  /**
   * Marks a locked order paid and fulfils it. An order released by expiry,
   * cancellation, or failure is still paid, because the buyer's money was
   * taken.
   */
  async markPaid(
    manager: EntityManager,
    order: Order,
    payment: Pick<
      GatewayResult,
      'reference' | 'paymentMethod' | 'settlementDate'
    >,
  ): Promise<void> {
    if (order.status !== OrderStatus.PENDING) {
      await reclaimOrderCodes(manager, order);
    }

    const settlementDate =
      payment.settlementDate && SETTLEMENT_DATE.test(payment.settlementDate)
        ? payment.settlementDate
        : await jakartaDate(manager, SETTLEMENT_FALLBACK_DAYS);
    await manager.update(
      Order,
      { id: order.id },
      {
        status: OrderStatus.PAID,
        paidAt: () => 'now()',
        paymentGatewayRef: payment.reference ?? order.paymentGatewayRef,
        paymentMethod: payment.paymentMethod?.slice(0, 20) ?? null,
        settlementDate,
      },
    );
    order.status = OrderStatus.PAID;
    await this.fulfillment.fulfil(manager, order);
    await queueOrderPaidEmails(manager, order.id);
  }

  // Moves a locked pending order to a closed status and releases its codes.
  async close(
    manager: EntityManager,
    order: Order,
    status: OrderStatus.FAILED | OrderStatus.EXPIRED | OrderStatus.CANCELLED,
  ): Promise<void> {
    await manager.update(Order, { id: order.id }, { status });
    order.status = status;
    await releaseOrderCodes(manager, order);
  }

  // Used when the invoice cannot be created for a just-created order.
  async failPending(orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (order?.status === OrderStatus.PENDING) {
        await this.close(manager, order, OrderStatus.FAILED);
      }
    });
  }

  async cancel(userId: string, orderId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query(
        `SELECT id, status = 'pending' AND expires_at > now() AS is_open
         FROM orders WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
         FOR UPDATE`,
        [orderId, userId],
      );
      if (!row) throw new NotFoundException('Order not found');
      if (!row.is_open) {
        throw new BadRequestException('Only an unpaid order can be cancelled');
      }
      const order = await manager.findOneBy(Order, { id: orderId });
      await this.close(manager, order, OrderStatus.CANCELLED);
    });
  }

  // Expires overdue pending orders; returns how many were expired.
  async expireOverdue(): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const overdue: Array<{ id: string }> = await manager.query(
        `SELECT id FROM orders
         WHERE status = 'pending' AND expires_at <= now() AND deleted_at IS NULL
         ORDER BY expires_at
         LIMIT ${EXPIRY_BATCH_SIZE}
         FOR UPDATE SKIP LOCKED`,
      );
      for (const { id } of overdue) {
        const order = await manager.findOneBy(Order, { id });
        await this.close(manager, order, OrderStatus.EXPIRED);
        await queueOrderClosedEmail(manager, order.id, 'expired');
      }
      return overdue.length;
    });
  }

  /**
   * Makes the net income of paid orders withdrawable once their settlement
   * date (Asia/Jakarta) has come; returns how many orders were settled.
   * Orders from before checkout existed have no settlement date and are
   * left alone.
   */
  async settleDue(): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const due: Array<{ id: string }> = await manager.query(
        `SELECT id FROM orders
         WHERE status = 'paid' AND settled_at IS NULL AND settlement_date IS NOT NULL
           AND settlement_date <= (now() AT TIME ZONE 'Asia/Jakarta')::date
           AND deleted_at IS NULL
         ORDER BY settlement_date, id
         LIMIT ${SETTLEMENT_BATCH_SIZE}
         FOR UPDATE SKIP LOCKED`,
      );
      if (due.length === 0) return 0;

      const orderIds = due.map((row) => row.id);
      const amounts = await merchantNetAmounts(manager, orderIds);
      await creditWallets(manager, amounts, 'settled');
      await queueBalanceSettledEmails(manager, orderIds, amounts);
      await manager
        .createQueryBuilder()
        .update(Order)
        .set({ settledAt: () => 'now()' })
        .whereInIds(orderIds)
        .execute();
      return due.length;
    });
  }
}

export async function jakartaDate(
  manager: EntityManager,
  daysFromToday = 0,
): Promise<string> {
  const [{ date }] = await manager.query(
    `SELECT ((now() AT TIME ZONE 'Asia/Jakarta')::date + $1::integer)::text AS date`,
    [daysFromToday],
  );
  return date;
}
