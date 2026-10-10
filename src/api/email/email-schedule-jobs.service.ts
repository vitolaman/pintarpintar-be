import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { queueDueMeetingReminders } from './events/learning-emails';
import { queueWeeklyMerchantReports } from './events/merchant-report-emails';
import { queueProExpiryEmails } from './events/pro-expiry-emails';

/** Scheduled emails that no user action triggers. */
@Injectable()
export class EmailScheduleJobs {
  private remindersRunning = false;
  private reportsRunning = false;
  private proExpiryRunning = false;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Every 5 minutes, so the first run inside the 10-to-60-minute window
  // reminds about an hour before; errors are logged by the email guard.
  @Cron('*/5 * * * *')
  async queueMeetingReminders(): Promise<void> {
    if (this.remindersRunning) return;
    this.remindersRunning = true;
    try {
      await queueDueMeetingReminders(this.dataSource.manager);
    } finally {
      this.remindersRunning = false;
    }
  }

  // Hourly on Mondays from 08.00 WIB: the first run sends last week's
  // reports, later runs catch up after downtime and otherwise add nothing.
  @Cron('0 8-23 * * 1', { timeZone: 'Asia/Jakarta' })
  async queueWeeklyReports(): Promise<void> {
    if (this.reportsRunning) return;
    this.reportsRunning = true;
    try {
      await queueWeeklyMerchantReports(this.dataSource.manager);
    } finally {
      this.reportsRunning = false;
    }
  }

  // Hourly from 08.00 WIB: the first run sends the day's Pro expiry emails,
  // later runs catch up after downtime and otherwise add nothing.
  @Cron('0 8-23 * * *', { timeZone: 'Asia/Jakarta' })
  async queueProExpiryEmails(): Promise<void> {
    if (this.proExpiryRunning) return;
    this.proExpiryRunning = true;
    try {
      await queueProExpiryEmails(this.dataSource.manager);
    } finally {
      this.proExpiryRunning = false;
    }
  }
}
