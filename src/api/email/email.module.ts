import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailReminderJobs } from './email-reminder-jobs.service';
import { EmailSenderService } from './email-sender.service';
import { MailSettings } from './mail-settings';

/**
 * Sends the queued automatic emails. Other modules only call `queueEmails`
 * inside their own transactions; they do not import this module.
 */
@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: new MailSettings(config).smtpTransport(),
      }),
    }),
  ],
  providers: [MailSettings, EmailSenderService, EmailReminderJobs],
  exports: [EmailSenderService],
})
export class EmailModule {}
