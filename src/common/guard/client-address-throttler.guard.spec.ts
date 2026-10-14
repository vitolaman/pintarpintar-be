import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ClientAddressThrottlerGuard,
  SIGN_IN_ACCOUNT_LIMIT,
  SIGN_IN_ACCOUNT_TTL_MS,
  SignInAccountThrottlerGuard,
} from './client-address-throttler.guard';

describe('ClientAddressThrottlerGuard', () => {
  const guard = Object.create(
    ClientAddressThrottlerGuard.prototype,
  ) as ClientAddressThrottlerGuard;
  const tracker = (req: Record<string, unknown>) =>
    (
      guard as unknown as {
        getTracker(req: Record<string, unknown>): Promise<string>;
      }
    ).getTracker(req);

  it('uses the Cloudflare visitor address when present', async () => {
    await expect(
      tracker({
        headers: { 'cf-connecting-ip': '203.0.113.7' },
        ip: '172.64.0.1',
      }),
    ).resolves.toBe('203.0.113.7');
  });

  it('falls back to the socket address', async () => {
    await expect(tracker({ headers: {}, ip: '127.0.0.1' })).resolves.toBe(
      '127.0.0.1',
    );
  });
});

describe('SignInAccountThrottlerGuard', () => {
  const guard = new SignInAccountThrottlerGuard(
    { throttlers: [] } as never,
    {} as never,
    {} as never,
  );
  const tracker = (req: object) =>
    (guard as unknown as { getTracker(r: object): Promise<string> }).getTracker(
      req,
    );

  it('counts per Cloudflare address and lower-cased email', async () => {
    await expect(
      tracker({
        headers: { 'cf-connecting-ip': '203.0.113.7' },
        body: { email: '  Budi@Example.com ' },
      }),
    ).resolves.toBe('203.0.113.7|budi@example.com');
    await expect(tracker({ ip: '10.0.0.1', body: {} })).resolves.toBe(
      '10.0.0.1|',
    );
  });

  it('applies its own limit whatever the route sets', async () => {
    const handle = jest
      .spyOn(ThrottlerGuard.prototype as never, 'handleRequest')
      .mockResolvedValue(true as never);
    await (
      guard as unknown as { handleRequest(p: object): Promise<boolean> }
    ).handleRequest({ limit: 100, ttl: 1, blockDuration: 1 });
    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: SIGN_IN_ACCOUNT_LIMIT,
        ttl: SIGN_IN_ACCOUNT_TTL_MS,
        blockDuration: SIGN_IN_ACCOUNT_TTL_MS,
      }),
    );
    handle.mockRestore();
  });
});
