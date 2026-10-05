import { Logger } from '@nestjs/common';
import {
  DatabaseLogger,
  describeDatabaseError,
  loggableParameters,
} from './database.logger';

describe('database query logging', () => {
  it('redacts the parameters of email and reset token statements', () => {
    expect(
      loggableParameters(
        'INSERT INTO "email_outbox"("kind", "payload") VALUES ($1, $2)',
        ['password_reset', '{"reset_token":"secret"}'],
      ),
    ).toEqual(['[redacted]']);
    expect(
      loggableParameters(
        'SELECT token.user_id FROM password_reset_tokens token WHERE token.token_hash = $1',
        ['abc'],
      ),
    ).toEqual(['[redacted]']);
  });

  it('keeps the parameters of other statements', () => {
    expect(
      loggableParameters('SELECT * FROM orders WHERE id = $1', ['order-1']),
    ).toEqual(['order-1']);
    expect(loggableParameters('SELECT 1')).toBeUndefined();
  });

  describe('production', () => {
    function productionLogger() {
      const logger = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as unknown as Logger & Record<'log' | 'warn' | 'error', jest.Mock>;
      const database = new DatabaseLogger(
        logger,
        ['error', 'warn', 'schema', 'migration'],
        { withParameters: false },
      );
      const written = () =>
        JSON.stringify([
          logger.log.mock.calls,
          logger.warn.mock.calls,
          logger.error.mock.calls,
        ]);
      return { logger, database, written };
    }

    it('does not log successful statements', () => {
      const { logger, database } = productionLogger();

      database.logQuery(
        'INSERT INTO "users"("email", "password_hash") VALUES ($1, $2)',
        ['ayu@example.test', '$2a$10$hash'],
      );

      expect(logger.log).not.toHaveBeenCalled();
    });

    it('logs a failed statement with its code and names, never the message or detail', () => {
      const { logger, database, written } = productionLogger();
      const error = Object.assign(
        new Error(
          'duplicate key value violates unique constraint "uq_users_email_active"',
        ),
        {
          driverError: {
            code: '23505',
            constraint: 'uq_users_email_active',
            table: 'users',
            detail: 'Key (lower(email))=(ayu@example.test) already exists.',
          },
        },
      );

      database.logQueryError(
        error,
        'INSERT INTO "users"("email") VALUES ($1)',
        ['ayu@example.test'],
      );

      expect(logger.error).toHaveBeenCalledWith(
        'query failed: INSERT INTO "users"("email") VALUES ($1) -- ERROR: code 23505, constraint uq_users_email_active, table users',
      );
      expect(written()).not.toContain('ayu@example.test');
    });

    it('does not log a message that quotes an input value', () => {
      const { logger, database, written } = productionLogger();
      const error = Object.assign(
        new Error('invalid input syntax for type uuid: "not-a-uuid"'),
        { driverError: { code: '22P02' } },
      );

      database.logQueryError(error, 'SELECT * FROM users WHERE id = $1', [
        'not-a-uuid',
      ]);

      expect(logger.error).toHaveBeenCalledWith(
        'query failed: SELECT * FROM users WHERE id = $1 -- ERROR: code 22P02',
      );
      expect(written()).not.toContain('not-a-uuid');
    });

    it('names an error without a code by its type', () => {
      expect(describeDatabaseError(new TypeError('boom'))).toBe('TypeError');
    });

    it('logs a slow statement with its duration and no values', () => {
      const { logger, database, written } = productionLogger();

      database.logQuerySlow(650, 'SELECT * FROM users WHERE email = $1', [
        'ayu@example.test',
      ]);

      expect(logger.warn).toHaveBeenCalledWith(
        'query is slow (650 ms): SELECT * FROM users WHERE email = $1',
      );
      expect(written()).not.toContain('ayu@example.test');
    });

    it('still logs warnings and migrations', () => {
      const { logger, database } = productionLogger();

      database.log('warn', 'deprecated option');
      database.logMigration('Migration X has been executed successfully.');

      expect(logger.warn).toHaveBeenCalledWith('deprecated option');
      expect(logger.log).toHaveBeenCalledWith(
        'Migration X has been executed successfully.',
      );
    });
  });

  it('keeps values outside production, redacting the sensitive tables', () => {
    const logger = { log: jest.fn() } as unknown as Logger & { log: jest.Mock };
    const database = new DatabaseLogger(logger, true);

    database.logQuery('SELECT * FROM orders WHERE id = $1', ['order-1']);
    database.logQuery('INSERT INTO "email_outbox"("payload") VALUES ($1)', [
      '{"reset_token":"secret-token"}',
    ]);

    const written = JSON.stringify(logger.log.mock.calls);
    expect(written).toContain('order-1');
    expect(written).not.toContain('secret-token');
    expect(written).toContain('[redacted]');
  });
});
