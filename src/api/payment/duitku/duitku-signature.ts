import { createHmac, timingSafeEqual } from 'crypto';

// Duitku signs with HMAC-SHA256 keyed by the project API key, as lowercase
// hex (MD5 and plain SHA256 signatures are obsolete since April 2026).
function hmac(message: string, apiKey: string): string {
  return createHmac('sha256', apiKey).update(message, 'utf8').digest('hex');
}

// `x-duitku-signature` for POP requests.
export function requestSignature(
  merchantCode: string,
  timestamp: string,
  apiKey: string,
): string {
  return hmac(merchantCode + timestamp, apiKey);
}

// Signature of a transaction status check.
export function statusSignature(
  merchantCode: string,
  merchantOrderId: string,
  apiKey: string,
): string {
  return hmac(merchantCode + merchantOrderId, apiKey);
}

// Verifies a callback over the amount exactly as posted.
export function isValidCallbackSignature(
  callback: { merchantCode: string; amount: string; merchantOrderId: string },
  signature: string,
  apiKey: string,
): boolean {
  const expected = Buffer.from(
    hmac(
      callback.merchantCode + callback.amount + callback.merchantOrderId,
      apiKey,
    ),
    'utf8',
  );
  const received = Buffer.from(signature.toLowerCase(), 'utf8');
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
