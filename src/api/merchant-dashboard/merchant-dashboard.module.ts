import { Module } from '@nestjs/common';
import { MerchantLevelModule } from '../merchant-level/merchant-level.module';
import { MerchantAnalyticsController } from './merchant-analytics.controller';
import { MerchantAnalyticsService } from './merchant-analytics.service';
import { MerchantDashboardController } from './merchant-dashboard.controller';
import { MerchantDashboardService } from './merchant-dashboard.service';
import { VisitTrackingController } from './visit-tracking.controller';
import { VisitTrackingService } from './visit-tracking.service';

@Module({
  imports: [MerchantLevelModule],
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
