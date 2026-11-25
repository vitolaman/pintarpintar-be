import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  ProTransaction,
  ProTransactionStatus,
} from '~/api/pro/entities/pro-transaction.entity';
import { MerchantProPeriod } from '~/api/pro/entities/merchant-pro-period.entity';
import {
  queueProSubscriptionPaidEmails,
  queueProSubscriptionFailedEmails,
} from '~/api/email/events/pro-subscription-emails';

export interface GatewayResult {
  transactionNumber: string;
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
 * Manages Pro subscription payment lifecycle: creation, payment notification,
 * and status updates. Similar to OrderPaymentService, each status change
 * locks the transaction row to ensure idempotency.
 */
@Injectable()
export class ProPaymentService {
  private readonly logger = new Logger(ProPaymentService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Process a payment gateway result for a Pro subscription.
   * Updates transaction status and creates the Pro period if payment succeeds.
   */
  async applyGatewayResult(result: GatewayResult): Promise<GatewayOutcome> {
    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager.findOne(ProTransaction, {
        where: { transactionNumber: result.transactionNumber },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transaction) {
        throw new NotFoundException('Pro transaction not found');
      }
      if (Number(result.amount) !== Number(transaction.totalAmount)) {
        throw new BadRequestException('Amount does not match the transaction');
      }
      if (transaction.status === ProTransactionStatus.PAID) return 'unchanged';

      if (result.resultCode === '00') {
        await this.markPaid(manager, transaction, result);
        this.logger.log(
          `Pro subscription ${transaction.transactionNumber} paid`,
        );
        return 'paid';
      }
      if (transaction.status === ProTransactionStatus.PENDING) {
        await this.failPending(manager, transaction);
        await queueProSubscriptionFailedEmails(manager, transaction.id);
        this.logger.log(
          `Pro subscription ${transaction.transactionNumber} failed with result ${result.resultCode}`,
        );
        return 'failed';
      }
      return 'unchanged';
    });
  }

  /**
   * Mark transaction as paid and create the corresponding Pro period. The
   * period starts when the merchant's latest active period ends, or now when
   * none ends later, and lasts the plan's months.
   */
  private async markPaid(
    manager: EntityManager,
    transaction: ProTransaction,
    payment: Pick<GatewayResult, 'reference' | 'paymentMethod'>,
  ): Promise<void> {
    const now = new Date();
    const startsAt = await nextPeriodStart(
      manager,
      transaction.merchantId,
      now,
    );
    const endsAt = new Date(startsAt);
    const durationMonths = transaction.durationMonths || 1;
    endsAt.setMonth(endsAt.getMonth() + durationMonths);

    await manager.update(
      ProTransaction,
      { id: transaction.id },
      {
        status: ProTransactionStatus.PAID,
        paidAt: now,
        paymentGatewayRef: payment.reference ?? transaction.paymentGatewayRef,
        paymentMethod: payment.paymentMethod?.slice(0, 20) ?? null,
      },
    );

    // Create the Pro period
    await manager.save(MerchantProPeriod, {
      merchantId: transaction.merchantId,
      planId: transaction.planId,
      planName: transaction.planName,
      durationMonths: transaction.durationMonths,
      price: transaction.totalAmount,
      startsAt,
      endsAt,
      source: 'payment',
      status: 'active',
    } as MerchantProPeriod);
    await queueProSubscriptionPaidEmails(manager, transaction.id);
  }

  /**
   * Mark a pending transaction as failed.
   */
  private async failPending(
    manager: EntityManager,
    transaction: ProTransaction,
  ): Promise<void> {
    await manager.update(
      ProTransaction,
      { id: transaction.id },
      { status: ProTransactionStatus.FAILED },
    );
  }

  /**
   * Used when the invoice cannot be created for a just-created transaction.
   */
  async failTransaction(transactionId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const transaction = await manager.findOne(ProTransaction, {
        where: { id: transactionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (transaction?.status === ProTransactionStatus.PENDING) {
        await this.failPending(manager, transaction);
      }
    });
  }

  /**
   * Cancel a pending Pro subscription.
   */
  async cancel(userId: string, transactionId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query(
        `SELECT id, status = 'pending' AND expires_at > now() AS is_open
         FROM pro_transactions WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
         FOR UPDATE`,
        [transactionId, userId],
      );
      if (!row) {
        throw new NotFoundException(
          'Pro transaction not found or not cancellable',
        );
      }
      if (!row.is_open) {
        throw new BadRequestException(
          'Only pending unpaid subscriptions can be cancelled',
        );
      }
      await manager.update(
        ProTransaction,
        { id: transactionId },
        { status: ProTransactionStatus.CANCELLED },
      );
    });
  }
}

// Periods of one merchant must not overlap. Payments for one merchant take
// turns on this lock until their transaction commits, so a second payment
// reads the period the first one added.
async function nextPeriodStart(
  manager: EntityManager,
  merchantId: string,
  now: Date,
): Promise<Date> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `pro-period:${merchantId}`,
  ]);
  const [{ latest_end }] = await manager.query(
    `SELECT max(ends_at) AS latest_end FROM merchant_pro_periods
     WHERE merchant_id = $1 AND status = 'active' AND deleted_at IS NULL`,
    [merchantId],
  );
  const latestEnd = latest_end ? new Date(latest_end) : null;
  return latestEnd && latestEnd > now ? latestEnd : now;
}
