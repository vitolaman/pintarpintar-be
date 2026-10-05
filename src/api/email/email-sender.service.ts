import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  describeFailure,
  isPermanentFailure,
  nextAttemptDelay,
} from './email-delivery-rules';
import { EmailOutbox } from './entities/email-outbox.entity';
import { MailSettings } from './mail-settings';
import {
  isEmailKind,
  renderEmail,
  SENSITIVE_PAYLOAD_FIELDS,
} from './templates';

const BATCH_SIZE = 25;
// A claimed email is retried after this time if its sender stopped midway.
const CLAIM_LEASE = "interval '5 minutes'";
const RETENTION = "interval '90 days'";

export interface DeliveryResult {
  sent: number;
  retried: number;
  failed: number;
  discarded: number;
}

/**
 * Sends queued emails. Each email is claimed by one sender at a time (also
 * across app instances) and sent outside any transaction, so a slow SMTP
 * server never holds database locks. Delivery is at least once: a crash
 * between sending and recording can send an email again after the lease.
 */
@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);
  private running = false;
  private warnedUnconfigured = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly mailer: MailerService,
    private readonly settings: MailSettings,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sendDueEmails(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.sendBatch();
      if (result.sent || result.failed || result.discarded) {
        this.logger.log(
          `Emails sent ${result.sent}, retried ${result.retried}, failed ${result.failed}, discarded ${result.discarded}`,
        );
      }
    } catch (error) {
      this.logger.error(`Email delivery failed: ${describeFailure(error)}`);
    } finally {
      this.running = false;
    }
  }

  @Cron('0 3 * * *', { timeZone: 'Asia/Jakarta' })
  async deleteOldEmails(): Promise<void> {
    try {
      const result = await this.dataSource
        .createQueryBuilder()
        .delete()
        .from(EmailOutbox)
        .where(
          `status IN ('sent', 'failed', 'discarded') AND created_at < now() - ${RETENTION}`,
        )
        .execute();
      if (result.affected) {
        this.logger.log(`Deleted ${result.affected} old emails`);
      }
    } catch (error) {
      this.logger.error(`Email cleanup failed: ${describeFailure(error)}`);
    }
  }

  async sendBatch(): Promise<DeliveryResult> {
    const result: DeliveryResult = {
      sent: 0,
      retried: 0,
      failed: 0,
      discarded: 0,
    };
    const missing = this.settings.missing();
    if (missing.length) {
      if (!this.warnedUnconfigured) {
        this.logger.warn(
          `Email is not configured (missing ${missing.join(', ')}); emails stay queued`,
        );
        this.warnedUnconfigured = true;
      }
      return result;
    }

    const { emails, discarded } = await this.claimDue();
    result.discarded = discarded;
    for (const email of emails) {
      const outcome = await this.send(email);
      result[outcome] += 1;
    }
    return result;
  }

  private async claimDue(): Promise<{
    emails: EmailOutbox[];
    discarded: number;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const stale = await manager
        .createQueryBuilder()
        .update(EmailOutbox)
        .set({ status: 'discarded' })
        .where("status IN ('pending', 'sending') AND expires_at <= now()")
        .execute();
      for (const [kind, fields] of Object.entries(SENSITIVE_PAYLOAD_FIELDS)) {
        await manager
          .createQueryBuilder()
          .update(EmailOutbox)
          .set({ payload: () => withoutFields(fields) })
          .where(
            "kind = :kind AND status = 'discarded' AND payload ?| :fields",
            {
              kind,
              fields,
            },
          )
          .execute();
      }
      const due: Array<{ id: string }> = await manager.query(
        `SELECT id FROM email_outbox
         WHERE status IN ('pending', 'sending') AND next_attempt_at <= now()
           AND expires_at > now() AND deleted_at IS NULL
         ORDER BY next_attempt_at, created_at, id
         LIMIT ${BATCH_SIZE}
         FOR UPDATE SKIP LOCKED`,
      );
      const ids = due.map((row) => row.id);
      if (ids.length) {
        await manager.update(
          EmailOutbox,
          { id: In(ids) },
          { status: 'sending', nextAttemptAt: () => `now() + ${CLAIM_LEASE}` },
        );
      }
      return {
        // In the claim query's due-time order: the lease just gave every
        // claimed row the same next_attempt_at, so it cannot order them.
        emails: ids.length
          ? inClaimOrder(
              ids,
              await manager.findBy(EmailOutbox, { id: In(ids) }),
            )
          : [],
        discarded: stale.affected ?? 0,
      };
    });
  }

  private async send(
    email: EmailOutbox,
  ): Promise<'sent' | 'retried' | 'failed'> {
    const attempts = email.attempts + 1;
    let rendered: ReturnType<typeof renderEmail>;
    try {
      if (!isEmailKind(email.kind)) {
        throw new Error(`unknown email kind ${email.kind}`);
      }
      rendered = renderEmail(
        email.kind,
        email.payload as never,
        this.settings.frontendUrl,
      );
    } catch (error) {
      await this.record(email, {
        status: 'failed',
        attempts,
        lastError: `render: ${describeFailure(error)}`,
      });
      this.logger.error(
        `Email ${email.id} (${email.kind}) cannot be rendered: ${describeFailure(error)}`,
      );
      return 'failed';
    }

    try {
      await this.mailer.sendMail({
        from: this.settings.sender,
        to: email.recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      await this.record(email, {
        status: 'sent',
        attempts,
        lastError: null,
        sentAt: () => 'now()',
      });
      return 'sent';
    } catch (error) {
      const reason = describeFailure(error);
      const delay = isPermanentFailure(error)
        ? null
        : nextAttemptDelay(attempts);
      if (delay === null) {
        await this.record(email, {
          status: 'failed',
          attempts,
          lastError: reason,
        });
        this.logger.warn(
          `Email ${email.id} (${email.kind}) failed after ${attempts} attempts: ${reason}`,
        );
        return 'failed';
      }
      await this.record(email, {
        status: 'pending',
        attempts,
        lastError: reason,
        nextAttemptAt: new Date(Date.now() + delay),
      });
      this.logger.warn(
        `Email ${email.id} (${email.kind}) attempt ${attempts} failed, retrying: ${reason}`,
      );
      return 'retried';
    }
  }

  // A final status also removes the fields that must not stay stored.
  private async record(
    email: EmailOutbox,
    changes: QueryDeepPartialEntity<EmailOutbox>,
  ): Promise<void> {
    const fields = isEmailKind(email.kind)
      ? SENSITIVE_PAYLOAD_FIELDS[email.kind]
      : undefined;
    const final = changes.status === 'sent' || changes.status === 'failed';
    await this.dataSource.manager.update(
      EmailOutbox,
      { id: email.id },
      fields && final
        ? { ...changes, payload: () => withoutFields(fields) }
        : changes,
    );
  }
}

// Field names come from SENSITIVE_PAYLOAD_FIELDS, never from input.
function withoutFields(fields: string[]): string {
  const names = fields.map((field) => `'${field.replace(/'/g, "''")}'`);
  return `payload - ARRAY[${names.join(', ')}]::text[]`;
}

function inClaimOrder(ids: string[], emails: EmailOutbox[]): EmailOutbox[] {
  const position = new Map(ids.map((id, index) => [id, index]));
  return [...emails].sort(
    (a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0),
  );
}
