import { Module } from '@nestjs/common';
import { MerchantAnalyticsController } from './merchant-analytics.controller';
import { MerchantAnalyticsService } from './merchant-analytics.service';
import { MerchantDashboardController } from './merchant-dashboard.controller';
import { MerchantDashboardService } from './merchant-dashboard.service';
import { VisitTrackingController } from './visit-tracking.controller';
import { VisitTrackingService } from './visit-tracking.service';

@Module({
  controllers: [
    MerchantDashboardController,
    MerchantAnalyticsController,
    VisitTrackingController,
  ],
  providers: [
    MerchantDashboardService,
    MerchantAnalyticsService,
    VisitTrackingService,
  ],
})
export class MerchantDashboardModule {}
