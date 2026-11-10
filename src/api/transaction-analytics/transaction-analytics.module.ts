import { Module } from '@nestjs/common';
import { TransactionAnalyticsController } from './transaction-analytics.controller';
import { TransactionAnalyticsService } from './transaction-analytics.service';

@Module({
  controllers: [TransactionAnalyticsController],
  providers: [TransactionAnalyticsService],
})
export class TransactionAnalyticsModule {}
