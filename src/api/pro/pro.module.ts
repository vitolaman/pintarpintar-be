import { Module } from '@nestjs/common';
import {
  MerchantProSubscriptionController,
  ProPlanController,
} from './pro.controller';
import { ProService } from './pro.service';

@Module({
  controllers: [ProPlanController, MerchantProSubscriptionController],
  providers: [ProService],
})
export class ProModule {}
