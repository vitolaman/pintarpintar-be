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

/** Where email links point unless FRONTEND_URL overrides it. */
export const DEFAULT_FRONTEND_URL = 'https://pintarpintar.id';

/** This API's public address, for email images, unless API_PUBLIC_URL overrides it. */
export const DEFAULT_API_PUBLIC_URL = 'https://api.pintarpintar.id';

const SMTP_TIMEOUT_MS = 20_000;

/**
 * Email settings from the environment. Until every required one is set,
 * emails stay queued instead of failing, so the app can run before SMTP
 * exists.
 */
@Injectable()
export class MailSettings {
  private readonly logger = new Logger(MailSettings.name);
  private readonly warnedUrls = new Set<string>();

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
    return this.publicUrl('FRONTEND_URL', DEFAULT_FRONTEND_URL);
  }

  /** API_PUBLIC_URL, checked like FRONTEND_URL. */
  get apiPublicUrl(): string {
    return this.publicUrl('API_PUBLIC_URL', DEFAULT_API_PUBLIC_URL);
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

  private publicUrl(name: string, fallback: string): string {
    const configured = this.config.get<string>(name)?.trim() ?? '';
    if (!configured) return fallback;
    if (/^https?:\/\/[^\s/?#]+/i.test(configured) && isUrl(configured)) {
      return configured.replace(/\/+$/, '');
    }
    if (!this.warnedUrls.has(name)) {
      this.logger.warn(`${name} is not an http(s) URL; emails use ${fallback}`);
      this.warnedUrls.add(name);
    }
    return fallback;
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
