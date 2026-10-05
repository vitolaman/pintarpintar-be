import { Logger } from '@nestjs/common';
import { DatabaseLogger, loggableParameters } from './database.logger';

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

  it('never writes a redacted parameter to the production log', () => {
    const logger = { log: jest.fn() } as unknown as Logger;
    const database = new DatabaseLogger(logger, true);

    database.logQuery('INSERT INTO "email_outbox"("payload") VALUES ($1)', [
      '{"reset_token":"secret-token"}',
    ]);
    database.logQuerySlow(900, 'UPDATE "email_outbox" SET "payload" = $1', [
      'secret-token',
    ]);

    const written = JSON.stringify((logger.log as jest.Mock).mock.calls);
    expect(written).not.toContain('secret-token');
    expect(written).toContain('[redacted]');
  });
});
