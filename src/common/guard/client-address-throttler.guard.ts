import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// The message of every 429 (ThrottlerModule `errorMessage`), also used as the
// documented example.
export const TOO_MANY_REQUESTS_MESSAGE =
  'Too many requests, please try again later';

// Rate limits by the visitor's address. Behind Cloudflare every request comes
// from a proxy, so the CF-Connecting-IP header (set by Cloudflare itself) is
// used when present; locally the socket address is used.
@Injectable()
export class ClientAddressThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const cloudflareAddress = req.headers?.['cf-connecting-ip'];
    if (typeof cloudflareAddress === 'string' && cloudflareAddress) {
      return cloudflareAddress;
    }
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }
}
