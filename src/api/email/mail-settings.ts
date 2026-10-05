import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Required before any email is sent. */
export const MAIL_VARIABLES = [
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_USERNAME',
  'MAIL_PASSWORD',
  'MAIL_SENDER',
] as const;

/** Where email links and the logo point unless FRONTEND_URL overrides it. */
export const DEFAULT_FRONTEND_URL = 'https://pintarpintar.id';

const SMTP_TIMEOUT_MS = 20_000;

/**
 * Email settings from the environment. Until every required one is set,
 * emails stay queued instead of failing, so the app can run before SMTP
 * exists.
 */
@Injectable()
export class MailSettings {
  private readonly logger = new Logger(MailSettings.name);
  private warnedFrontendUrl = false;

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

  /**
   * FRONTEND_URL when it is an absolute http(s) URL, otherwise the default.
   * A value that is set but unusable is logged once (name only), so a typo
   * never sends broken links.
   */
  get frontendUrl(): string {
    const configured = this.config.get<string>('FRONTEND_URL')?.trim() ?? '';
    if (!configured) return DEFAULT_FRONTEND_URL;
    if (/^https?:\/\/[^\s/?#]+/i.test(configured) && isUrl(configured)) {
      return configured.replace(/\/+$/, '');
    }
    if (!this.warnedFrontendUrl) {
      this.logger.warn(
        `FRONTEND_URL is not an http(s) URL; email links use ${DEFAULT_FRONTEND_URL}`,
      );
      this.warnedFrontendUrl = true;
    }
    return DEFAULT_FRONTEND_URL;
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

function isUrl(value: string): boolean {
  try {
    return Boolean(new URL(value));
  } catch {
    return false;
  }
}
