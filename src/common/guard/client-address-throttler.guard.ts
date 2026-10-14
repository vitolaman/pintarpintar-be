import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerRequest } from '@nestjs/throttler';

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

// Sign-in attempts per account from one address, beside the per-address limit:
// guessing one account's password is stopped early, while many people on a
// shared network (campus wifi, mobile carriers) can still sign in.
export const SIGN_IN_ACCOUNT_LIMIT = 10;
export const SIGN_IN_ACCOUNT_TTL_MS = 600_000;

@Injectable()
export class SignInAccountThrottlerGuard extends ClientAddressThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const address = await super.getTracker(req);
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    return `${address}|${email}`;
  }

  protected handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    return super.handleRequest({
      ...requestProps,
      limit: SIGN_IN_ACCOUNT_LIMIT,
      ttl: SIGN_IN_ACCOUNT_TTL_MS,
      blockDuration: SIGN_IN_ACCOUNT_TTL_MS,
    });
  }
}
