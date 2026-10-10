import { Module } from '@nestjs/common';
import {
  MerchantProSubscriptionController,
  ProPlanController,
  ProSubscriptionController,
} from './pro.controller';
import { ProService } from './pro.service';
import { ProCheckoutService } from './pro-checkout.service';
import { PaymentModule } from '~/api/payment/payment.module';

@Module({
  imports: [PaymentModule],
  controllers: [
    ProPlanController,
    MerchantProSubscriptionController,
    ProSubscriptionController,
  ],
  providers: [ProService, ProCheckoutService],
})
export class ProModule {}
