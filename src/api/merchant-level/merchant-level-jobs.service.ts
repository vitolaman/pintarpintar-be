import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MerchantLevelService } from './merchant-level.service';

/**
 * Evaluates the month that just ended. It runs daily so that a missed run on
 * the 1st is caught up the next day; on other days nothing is pending.
 */
@Injectable()
export class MerchantLevelJobsService {
  private readonly logger = new Logger(MerchantLevelJobsService.name);

  constructor(private readonly merchantLevels: MerchantLevelService) {}

  @Cron('30 0 * * *', { timeZone: 'Asia/Jakarta' })
  async evaluateEndedMonth(): Promise<void> {
    try {
      const evaluated = await this.merchantLevels.evaluateEndedMonth();
      if (evaluated > 0) {
        this.logger.log(`Evaluated the levels of ${evaluated} merchants`);
      }
    } catch (error) {
      this.logger.error(`Merchant level evaluation failed: ${error}`);
    }
  }
}
