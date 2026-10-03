import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MerchantIncomeService, RECENT_DAYS } from './merchant-income.service';

/**
 * Rebuilds the stored daily income before the application serves requests,
 * then keeps the most recent closed days current. Readers compute yesterday
 * and today themselves, so a late or skipped run never makes a figure wrong
 * while it is within the recent days.
 */
@Injectable()
export class MerchantIncomeJobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MerchantIncomeJobsService.name);

  constructor(private readonly merchantIncome: MerchantIncomeService) {}

  async onApplicationBootstrap(): Promise<void> {
    const startedAt = Date.now();
    const rows = await this.merchantIncome.rebuild();
    this.logger.log(
      `Rebuilt ${rows} merchant daily income rows in ${Date.now() - startedAt} ms`,
    );
  }

  @Cron('*/10 * * * *', { timeZone: 'Asia/Jakarta' })
  async refreshRecentDays(): Promise<void> {
    try {
      const rows = await this.merchantIncome.refreshRecentDays();
      if (rows === null) {
        this.logger.log(
          `Skipped the ${RECENT_DAYS}-day income refresh: another refresh is running`,
        );
      }
    } catch (error) {
      this.logger.error(`Merchant daily income refresh failed: ${error}`);
    }
  }
}
