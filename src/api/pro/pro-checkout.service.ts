import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ProPlan } from './entities/pro-plan.entity';
import { ProTransaction, ProTransactionStatus } from './entities/pro-transaction.entity';
import { Merchant } from '~/api/merchant/entities/merchant.entity';
import { User } from '~/api/user/entities/user.entity';
import { DuitkuClient } from '~/api/payment/duitku/duitku.client';
import { ProPaymentService } from '~/api/payment/pro-payment.service';
import {
  MINIMUM_PAYMENT_AMOUNT,
  PAYMENT_EXPIRY_MINUTES,
} from '~/api/payment/payment.constants';
import { queueProSubscriptionAwaitingPaymentEmail } from '~/api/email/events/pro-subscription-emails';
import { jakartaDate } from '~/api/payment/order-payment.service';

@Injectable()
export class ProCheckoutService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly duitku: DuitkuClient,
    private readonly payments: ProPaymentService,
  ) {}

  /**
   * Preview the pricing for a Pro plan subscription with optional discount code.
   */
  async preview(userId: string, planId: string, code?: string) {
    const plan = await this.dataSource.manager.findOne(ProPlan, {
      where: { id: planId, isOffered: true },
    });
    if (!plan) throw new NotFoundException('Pro plan not found');

    // TODO: Calculate discount from code if provided
    const discountAmount = 0;
    const totalAmount = Number(plan.price) - discountAmount;

    if (totalAmount > 0 && totalAmount < MINIMUM_PAYMENT_AMOUNT) {
      throw new BadRequestException(
        `Minimum payment amount is ${MINIMUM_PAYMENT_AMOUNT}`,
      );
    }

    return {
      data: {
        plan_id: plan.id,
        plan_name: plan.name,
        duration_months: plan.durationMonths,
        base_price: Number(plan.price),
        discount_amount: discountAmount,
        total_amount: totalAmount,
      },
      responseMessage: 'Preview Pro subscription success',
    };
  }

  /**
   * Create a Pro subscription transaction and Duitku invoice.
   * A Rp0 subscription is marked paid immediately without invoicing.
   */
  async checkout(userId: string, planId: string, code?: string) {
    const user = await this.dataSource.manager.findOneByOrFail(User, {
      id: userId,
    });

    const merchant = await this.dataSource.manager.findOne(Merchant, {
      where: { userId },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const { transaction, totalAmount } = await this.dataSource.transaction(
      (manager) => this.createTransaction(manager, userId, merchant.id, planId),
    );

    // For free plans (Rp0), mark as paid immediately
    if (totalAmount === 0) {
      await this.payments.applyGatewayResult({
        transactionNumber: transaction.transactionNumber!,
        resultCode: '00',
        amount: '0',
        reference: null,
        paymentMethod: null,
        settlementDate: null,
      });
      const updated = await this.dataSource.manager.findOne(ProTransaction, {
        where: { id: transaction.id },
      });
      return {
        data: toCheckoutResponse(updated!),
        responseMessage: 'Pro subscription purchased successfully',
      };
    }

    // Create Duitku invoice for paid plans
    try {
      const invoice = await this.duitku.createInvoice({
        orderId: transaction.id,
        orderNumber: transaction.transactionNumber!,
        amount: totalAmount,
        productDetails: `Pintar Pintar Pro - ${transaction.planName} (${transaction.durationMonths} bulan)`,
        email: user.email,
        customerName: user.name,
        items: [
          {
            name: transaction.planName!,
            price: totalAmount,
          },
        ],
      });

      await this.dataSource.manager.update(
        ProTransaction,
        { id: transaction.id },
        {
          paymentGatewayRef: invoice.reference,
          paymentUrl: invoice.paymentUrl,
        },
      );

      await queueProSubscriptionAwaitingPaymentEmail(
        this.dataSource.manager,
        transaction.id,
      );
    } catch (error) {
      await this.payments.failTransaction(transaction.id);
      throw error;
    }

    const updated = await this.dataSource.manager.findOne(ProTransaction, {
      where: { id: transaction.id },
    });

    return {
      data: toCheckoutResponse(updated!),
      responseMessage: 'Pro subscription checkout created',
    };
  }

  private async createTransaction(
    manager: EntityManager,
    userId: string,
    merchantId: string,
    planId: string,
  ) {
    const plan = await manager.findOne(ProPlan, {
      where: { id: planId, isOffered: true },
    });
    if (!plan) throw new NotFoundException('Pro plan not found');

    // TODO: Apply discount code if provided
    const discountAmount = 0;
    const totalAmount = Number(plan.price) - discountAmount;

    if (totalAmount > 0 && totalAmount < MINIMUM_PAYMENT_AMOUNT) {
      throw new BadRequestException(
        `Minimum payment amount is ${MINIMUM_PAYMENT_AMOUNT}`,
      );
    }

    const now = new Date();
    
    // Generate transaction number first
    const transactionNumber = await nextProTransactionNumber(manager);

    const transaction = await manager.save(ProTransaction, {
      userId,
      merchantId,
      planId,
      planName: plan.name,
      durationMonths: plan.durationMonths,
      totalAmount: totalAmount.toString(),
      discountAmount: discountAmount.toString(),
      status: ProTransactionStatus.PENDING,
      expiresAt: new Date(now.getTime() + PAYMENT_EXPIRY_MINUTES * 60 * 1000),
      transactionNumber,
    } as ProTransaction);

    return { transaction, totalAmount };
  }

  async cancel(userId: string, transactionId: string): Promise<void> {
    await this.payments.cancel(userId, transactionId);
  }
}

// `PRO-YYYYMMDD-NNNN` on the Asia/Jakarta date.
async function nextProTransactionNumber(manager: EntityManager): Promise<string> {
  const day = (await jakartaDate(manager)).replace(/-/g, '');
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `pro-transaction:${day}`,
  ]);
  const [{ last }] = await manager.query(
    `SELECT max(substring(transaction_number FROM 15)::integer) AS last
     FROM pro_transactions WHERE transaction_number LIKE $1`,
    [`PRO-${day}-%`],
  );
  return `PRO-${day}-${String((last ?? 0) + 1).padStart(4, '0')}`;
}

function toCheckoutResponse(transaction: ProTransaction) {
  return {
    transaction_id: transaction.id,
    transaction_number: transaction.transactionNumber,
    amount: Number(transaction.totalAmount) + Number(transaction.discountAmount),
    discount_amount: Number(transaction.discountAmount),
    total_amount: Number(transaction.totalAmount),
    status: transaction.status,
    payment_reference: transaction.paymentGatewayRef,
    payment_url: transaction.paymentUrl,
    created_at: transaction.created_at,
    expires_at: transaction.expiresAt,
    paid_at: transaction.paidAt,
  };
}
