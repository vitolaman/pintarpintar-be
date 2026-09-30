import { Module } from '@nestjs/common';
import { MerchantDashboardController } from './merchant-dashboard.controller';
import { MerchantDashboardService } from './merchant-dashboard.service';

@Module({
  controllers: [MerchantDashboardController],
  providers: [MerchantDashboardService],
})
export class MerchantDashboardModule {}
