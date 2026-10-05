import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const MAIL_VARIABLES = [
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_USERNAME',
  'MAIL_PASSWORD',
  'MAIL_SENDER',
  'FRONTEND_URL',
] as const;

const SMTP_TIMEOUT_MS = 20_000;

/**
 * Email settings from the environment. Until every one is set, emails stay
 * queued instead of failing, so the app can run before SMTP exists.
 */
@Injectable()
export class MailSettings {
  constructor(private readonly config: ConfigService) {}

  /** Names of the variables that are missing or invalid (never values). */
  missing(): string[] {
    const missing = MAIL_VARIABLES.filter((name) => !this.value(name));
    if (this.value('MAIL_PORT') && !this.port()) missing.push('MAIL_PORT');
    return missing;
  }

  get sender(): string {
    return this.value('MAIL_SENDER');
  }

  get frontendUrl(): string {
    return this.value('FRONTEND_URL').replace(/\/+$/, '');
  }

  /** nodemailer SMTP options; 465 is implicit TLS, others use STARTTLS. */
  smtpTransport() {
    const port = this.port() ?? 587;
    return {
      host: this.value('MAIL_HOST') || 'localhost',
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: {
        user: this.value('MAIL_USERNAME'),
        pass: this.value('MAIL_PASSWORD'),
      },
      pool: true,
      maxConnections: 2,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    };
  }

  private port(): number | null {
    const port = Number(this.value('MAIL_PORT'));
    return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
  }

  private value(name: (typeof MAIL_VARIABLES)[number]): string {
    return this.config.get<string>(name)?.trim() ?? '';
  }
}
