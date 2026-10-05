import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { queueDueMeetingReminders } from './events/learning-emails';

/** Scheduled emails that no user action triggers. */
@Injectable()
export class EmailReminderJobs {
  private running = false;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Every 5 minutes, so the first run inside the 10-to-60-minute window
  // reminds about an hour before; errors are logged by the email guard.
  @Cron('*/5 * * * *')
  async queueMeetingReminders(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await queueDueMeetingReminders(this.dataSource.manager);
    } finally {
      this.running = false;
    }
  }
}
