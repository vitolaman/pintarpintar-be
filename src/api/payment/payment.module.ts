import { Module } from '@nestjs/common';
import { DuitkuClient } from './duitku/duitku.client';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrderPaymentService } from './order-payment.service';
import { PaymentCallbackController } from './payment-callback.controller';
import { PaymentJobsService } from './payment-jobs.service';

@Module({
  controllers: [PaymentCallbackController],
  providers: [
    DuitkuClient,
    OrderFulfillmentService,
    OrderPaymentService,
    PaymentJobsService,
  ],
  exports: [DuitkuClient, OrderPaymentService],
})
export class PaymentModule {}
