import { Logger } from '@nestjs/common';
import { AdvancedConsoleLogger, Logger as TypeORMLogger } from 'typeorm';
import { LoggerOptions as TypeORMLoggerOptions } from 'typeorm/logger/LoggerOptions';

// Statements on these tables carry secrets or personal data in their
// parameters: queued email payloads (reset tokens, names, orders) and reset
// token hashes. Their parameters are never logged.
const REDACTED_TABLES = /\b(email_outbox|password_reset_tokens)\b/;

/** The parameters to log for a statement, or a marker when redacted. */
export function loggableParameters(
  query: string,
  parameters?: any[],
): any[] | undefined {
  if (!parameters?.length) return parameters;
  return REDACTED_TABLES.test(query) ? ['[redacted]'] : parameters;
}

/** TypeORM's console logger for development, with the same redaction. */
export class RedactingConsoleLogger extends AdvancedConsoleLogger {
  logQuery(query: string, parameters?: any[]) {
    super.logQuery(query, loggableParameters(query, parameters));
  }

  logQueryError(error: string, query: string, parameters?: any[]) {
    super.logQueryError(error, query, loggableParameters(query, parameters));
  }

  logQuerySlow(time: number, query: string, parameters?: any[]) {
    super.logQuerySlow(time, query, loggableParameters(query, parameters));
  }
}

export interface DatabaseLoggerOptions {
  // Production passes false: parameter values (password hashes, emails,
  // account numbers, payloads) never reach the log, whatever `logging` lists.
  withParameters: boolean;
}

export class DatabaseLogger implements TypeORMLogger {
  constructor(
    private readonly _logger: Logger,
    private readonly _options: TypeORMLoggerOptions,
    private readonly output: DatabaseLoggerOptions = { withParameters: true },
  ) {}

  /**
   * Logs query and parameters used in it.
   */
  logQuery(query: string, parameters?: any[]) {
    if (
      this._options === 'all' ||
      this._options === true ||
      (this._options instanceof Array && this._options.indexOf('query') !== -1)
    ) {
      this._logger.log('query' + ': ' + this.statement(query, parameters));
    }
  }

  /**
   * Logs query that is failed. Without parameters (production) only the
   * error's code and the constraint, table or column it names are written:
   * PostgreSQL messages and details quote input values, e.g. an invalid
   * uuid or a duplicate email.
   */
  logQueryError(error: string | Error, query: string, parameters?: any[]) {
    if (
      this._options === 'all' ||
      this._options === true ||
      (this._options instanceof Array && this._options.indexOf('error') !== -1)
    ) {
      const reason = this.output.withParameters
        ? error instanceof Error
          ? error.message
          : String(error)
        : describeDatabaseError(error);
      this._logger.error(
        `query failed: ${this.statement(query, parameters)} -- ERROR: ${reason}`,
      );
    }
  }

  /**
   * Logs query that is slow.
   */
  logQuerySlow(time: number, query: string, parameters?: any[]) {
    this._logger.warn(
      `query is slow (${time} ms): ${this.statement(query, parameters)}`,
    );
  }

  private statement(query: string, queryParameters?: any[]): string {
    if (!this.output.withParameters) return query;
    const parameters = loggableParameters(query, queryParameters);
    return (
      query +
      (parameters && parameters.length
        ? ' -- PARAMETERS: ' + this.stringifyParams(parameters)
        : '')
    );
  }

  /**
   * Logs events from the schema build process.
   */
  logSchemaBuild(message: string) {
    if (
      this._options === 'all' ||
      (this._options instanceof Array && this._options.indexOf('schema') !== -1)
    ) {
      this._logger.log(message);
    }
  }

  /**
   * Logs events from the migrations run process.
   */
  logMigration(message: string) {
    this._logger.log(message);
  }

  /**
   * Perform logging using given logger, or by default to the this._logger.
   * Log has its own level and message.
   */
  log(level: 'log' | 'info' | 'warn', message: any) {
    switch (level) {
      case 'log':
        if (
          this._options === 'all' ||
          (this._options instanceof Array &&
            this._options.indexOf('log') !== -1)
        )
          this._logger.log(message);
        break;
      case 'info':
        if (
          this._options === 'all' ||
          (this._options instanceof Array &&
            this._options.indexOf('info') !== -1)
        )
          this._logger.debug(message);
        break;
      case 'warn':
        if (
          this._options === 'all' ||
          (this._options instanceof Array &&
            this._options.indexOf('warn') !== -1)
        )
          this._logger.warn(message);
        break;
    }
  }

  /**
   * Converts parameters to a string.
   * Sometimes parameters can have circular objects and therefor we are handle this case too.
   */
  protected stringifyParams(parameters: any[]) {
    try {
      return JSON.stringify(parameters);
    } catch (error) {
      // most probably circular objects in parameters
      return parameters;
    }
  }
}

interface DatabaseErrorFields {
  name?: string;
  code?: string;
  constraint?: string;
  table?: string;
  column?: string;
  driverError?: DatabaseErrorFields;
}

/** An error's SQLSTATE code and the names it refers to, never its message. */
export function describeDatabaseError(error: unknown): string {
  const outer = (error ?? {}) as DatabaseErrorFields;
  const source = outer.driverError ?? outer;
  const parts = [
    source.code && `code ${source.code}`,
    source.constraint && `constraint ${source.constraint}`,
    source.table && `table ${source.table}`,
    source.column && `column ${source.column}`,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : (outer.name ?? 'unknown error');
}
