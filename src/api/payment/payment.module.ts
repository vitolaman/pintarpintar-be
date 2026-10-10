import { Module } from '@nestjs/common';
import { DuitkuClient } from './duitku/duitku.client';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrderPaymentService } from './order-payment.service';
import { ProPaymentService } from './pro-payment.service';
import { PaymentCallbackController } from './payment-callback.controller';
import { PaymentJobsService } from './payment-jobs.service';

@Module({
  controllers: [PaymentCallbackController],
  providers: [
    DuitkuClient,
    OrderFulfillmentService,
    OrderPaymentService,
    ProPaymentService,
    PaymentJobsService,
  ],
  exports: [DuitkuClient, OrderPaymentService, ProPaymentService],
})
export class PaymentModule {}
