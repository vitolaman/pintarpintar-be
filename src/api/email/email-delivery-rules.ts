// Retry policy for SMTP sends, kept free of I/O so it is unit tested.

const MINUTE_MS = 60 * 1000;
/** Waits before attempts 2 to 6; the sixth failure is final. */
export const RETRY_DELAYS_MS = [1, 5, 15, 60, 360].map(
  (minutes) => minutes * MINUTE_MS,
);
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

interface SmtpError {
  code?: string;
  responseCode?: number;
  command?: string;
  message?: string;
}

/**
 * A rejection that retrying cannot fix: the server refusing this recipient
 * or this message (5xx on RCPT TO or DATA), or an envelope with no usable
 * recipient. A 4xx reply is temporary by definition, also when nodemailer
 * reports it as an envelope error. Login, connection and sender-address
 * errors are configuration problems a server-side fix resolves, so they are
 * retried.
 */
export function isPermanentFailure(error: unknown): boolean {
  const smtp = (error ?? {}) as SmtpError;
  const reply = smtp.responseCode;
  if (typeof reply === 'number' && reply >= 400 && reply < 500) return false;
  const permanentReply =
    typeof reply === 'number' && reply >= 500 && reply < 600;
  if (smtp.code === 'EENVELOPE') return reply === undefined || permanentReply;
  return permanentReply && ['RCPT TO', 'DATA'].includes(smtp.command ?? '');
}

/** The SMTP reply code and the first line of the reason, at most 500 chars. */
export function describeFailure(error: unknown): string {
  const smtp = (error ?? {}) as SmtpError;
  const reason = String(smtp.message ?? error ?? 'unknown error')
    .split('\n')[0]
    .trim();
  const prefix = [smtp.code, smtp.responseCode, smtp.command]
    .filter((part) => part !== undefined && part !== '')
    .join(' ');
  return `${prefix ? `${prefix}: ` : ''}${reason}`.slice(0, 500);
}

/** When to try again after `attempts` failures, or null when it is final. */
export function nextAttemptDelay(attempts: number): number | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  return RETRY_DELAYS_MS[attempts - 1] ?? null;
}
