import { HttpStatus, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { TOO_MANY_REQUESTS_MESSAGE } from '~/common/guard/client-address-throttler.guard';
import {
  SIGN_IN_FAILURE_LIMIT,
  SIGN_IN_FAILURE_WINDOW_SECONDS,
  SignInFailures,
  signInEmailHash,
} from './sign-in-failures';

describe('SignInFailures', () => {
  let query: jest.Mock;
  let failures: SignInFailures;

  beforeEach(() => {
    query = jest.fn();
    failures = new SignInFailures({ query } as unknown as DataSource);
  });

  it('allows 10 failures in 15 minutes per email', () => {
    expect(SIGN_IN_FAILURE_LIMIT).toBe(10);
    expect(SIGN_IN_FAILURE_WINDOW_SECONDS).toBe(900);
  });

  it('counts an attempt by the email hash, never the email', async () => {
    query.mockResolvedValue([{ failure_count: 1 }]);
    await failures.countAttempt('John@Example.com');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (email_hash) DO UPDATE');
    expect(params).toEqual([signInEmailHash('john@example.com'), 900]);
    expect(JSON.stringify(params)).not.toContain('example.com');
  });

  it('normalizes the email like sign-in does', () => {
    expect(signInEmailHash('  John@Example.COM ')).toBe(
      signInEmailHash('john@example.com'),
    );
    expect(signInEmailHash('john@example.com')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('lets the 10th attempt through and answers the 11th with the throttle 429', async () => {
    query.mockResolvedValueOnce([{ failure_count: 10 }]);
    await expect(failures.countAttempt('a@b.test')).resolves.toBeUndefined();

    query.mockResolvedValueOnce([{ failure_count: 11 }]);
    const error = await failures.countAttempt('a@b.test').catch((e) => e);
    expect(error).toBeInstanceOf(ThrottlerException);
    expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(error.message).toBe(TOO_MANY_REQUESTS_MESSAGE);
  });

  it('clears the count of an email', async () => {
    query.mockResolvedValue([[], 1]);
    await failures.clear('John@Example.com');
    expect(query).toHaveBeenCalledWith(
      'DELETE FROM sign_in_failures WHERE email_hash = $1',
      [signInEmailHash('john@example.com')],
    );
  });

  it('deletes ended windows and survives a database error', async () => {
    query.mockResolvedValueOnce([[], 3]);
    await expect(failures.deleteEndedWindows()).resolves.toBe(3);
    expect(query.mock.calls[0][1]).toEqual([900]);

    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    query.mockRejectedValueOnce(new Error('connection lost'));
    await expect(failures.deleteEndedWindows()).resolves.toBe(0);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
