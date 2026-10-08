import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { queueWithdrawalOutcomeEmails } from '~/api/email/events/merchant-emails';

/**
 * Withdrawals are completed by hand outside the API, so their outcome emails
 * are queued by polling. Deduplication keys make overlapping runs and several
 * instances harmless.
 */
@Injectable()
export class MerchantWithdrawalJobsService {
  private readonly logger = new Logger(MerchantWithdrawalJobsService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Cron('*/10 * * * *')
  async queueOutcomeEmails(): Promise<void> {
    try {
      const queued = await this.dataSource.transaction((manager) =>
        queueWithdrawalOutcomeEmails(manager),
      );
      if (queued > 0) {
        this.logger.log(`Queued ${queued} withdrawal outcome emails`);
      }
    } catch (error) {
      this.logger.error(`Withdrawal outcome emails failed: ${error}`);
    }
  }
}
