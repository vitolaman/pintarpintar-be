import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderPaymentService } from './order-payment.service';

/**
 * Background order upkeep. Both jobs lock rows with SKIP LOCKED, so runs on
 * several instances, or an overlapping run, never apply an order twice.
 */
@Injectable()
export class PaymentJobsService {
  private readonly logger = new Logger(PaymentJobsService.name);

  constructor(private readonly payments: OrderPaymentService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireOverdueOrders(): Promise<void> {
    try {
      const expired = await this.payments.expireOverdue();
      if (expired > 0) this.logger.log(`Expired ${expired} unpaid orders`);
    } catch (error) {
      this.logger.error(`Order expiry failed: ${error}`);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async settleDueOrders(): Promise<void> {
    try {
      const settled = await this.payments.settleDue();
      if (settled > 0) this.logger.log(`Settled ${settled} paid orders`);
    } catch (error) {
      this.logger.error(`Order settlement failed: ${error}`);
    }
  }
}
