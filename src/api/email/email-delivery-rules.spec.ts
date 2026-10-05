import {
  describeFailure,
  isPermanentFailure,
  MAX_ATTEMPTS,
  nextAttemptDelay,
} from './email-delivery-rules';

const MINUTE = 60 * 1000;

describe('email retry rules', () => {
  it('waits 1, 5, 15, 60 and 360 minutes, then gives up after six attempts', () => {
    expect([1, 2, 3, 4, 5].map(nextAttemptDelay)).toEqual([
      MINUTE,
      5 * MINUTE,
      15 * MINUTE,
      60 * MINUTE,
      360 * MINUTE,
    ]);
    expect(MAX_ATTEMPTS).toBe(6);
    expect(nextAttemptDelay(6)).toBeNull();
  });

  it.each([
    ['an unknown recipient', { responseCode: 550, command: 'RCPT TO' }],
    ['a rejected message', { responseCode: 554, command: 'DATA' }],
    ['no valid recipient', { code: 'EENVELOPE' }],
    [
      'every recipient refused permanently',
      { code: 'EENVELOPE', responseCode: 550, command: 'RCPT TO' },
    ],
  ])('treats %s as permanent', (_name, error) => {
    expect(isPermanentFailure(error)).toBe(true);
  });

  it.each([
    [
      'a failed login',
      { code: 'EAUTH', responseCode: 535, command: 'AUTH PLAIN' },
    ],
    ['a refused sender address', { responseCode: 553, command: 'MAIL FROM' }],
    ['a busy server', { responseCode: 421, command: 'RCPT TO' }],
    [
      'a recipient deferred with 451',
      { code: 'EENVELOPE', responseCode: 451, command: 'RCPT TO' },
    ],
    ['a connection error', { code: 'ECONNECTION' }],
    ['a timeout', { code: 'ETIMEDOUT' }],
    ['a plain error', new Error('socket hang up')],
  ])('retries %s', (_name, error) => {
    expect(isPermanentFailure(error)).toBe(false);
  });

  it('keeps only the code and the first line of the reason', () => {
    const error = Object.assign(new Error('550 5.1.1 No such user\nmore'), {
      code: 'EENVELOPE',
      responseCode: 550,
      command: 'RCPT TO',
    });
    expect(describeFailure(error)).toBe(
      'EENVELOPE 550 RCPT TO: 550 5.1.1 No such user',
    );
    expect(describeFailure(new Error('x'.repeat(900)))).toHaveLength(500);
  });
});
