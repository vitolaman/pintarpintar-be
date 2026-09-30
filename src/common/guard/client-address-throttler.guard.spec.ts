import { ClientAddressThrottlerGuard } from './client-address-throttler.guard';

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
