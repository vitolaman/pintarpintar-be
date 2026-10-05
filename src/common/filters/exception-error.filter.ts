import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { describeDatabaseError } from '~/database/database.logger';

export interface ExceptionLogOptions {
  // Production: a database error is logged by its code and the names it
  // refers to, because PostgreSQL messages quote input values.
  sanitizeDatabaseErrors: boolean;
}

@Catch()
export class CustomHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  constructor(
    private readonly options: ExceptionLogOptions = {
      sanitizeDatabaseErrors: false,
    },
  ) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()['message'] || exception.message
        : 'Internal server error';

    // One readable message for a toast; validation failures also list every
    // reason in `errors`.
    const messages: string[] = (
      Array.isArray(message) ? message : [message]
    ).map(String);
    const errorResponse = {
      statusCode: status,
      error: HttpStatus[status] || 'INTERNAL_SERVER_ERROR',
      responseMessage: messages[0] ?? 'Internal server error',
      ...(Array.isArray(message) ? { errors: messages } : {}),
    };
    const details = errorDetails(exception);
    this.log(
      status,
      ctx.getRequest(),
      errorResponse.responseMessage,
      exception,
    );

    response
      .status(status)
      .json(details ? { ...errorResponse, details } : errorResponse);
  }

  /**
   * One line per error response, without bodies, query strings or headers:
   * client errors as a warning with the message sent back, server errors
   * with their stack.
   */
  private log(
    status: number,
    request: { method?: string; path?: string } | undefined,
    responseMessage: string,
    exception: unknown,
  ): void {
    const where = `${status} ${describeRequest(request)}`;
    if (status < 500) {
      this.logger.warn(`${where}: ${responseMessage}`);
      return;
    }
    const error = exception instanceof Error ? exception : undefined;
    if (
      this.options.sanitizeDatabaseErrors &&
      exception instanceof QueryFailedError
    ) {
      this.logger.error(
        `${where}: QueryFailedError (${describeDatabaseError(exception)})`,
        stackFrames(error?.stack),
      );
      return;
    }
    this.logger.error(
      `${where}: ${error ? `${error.name}: ${error.message}` : String(exception)}`,
      error?.stack,
    );
  }
}

// Path only: query strings can carry searches and other user input.
function describeRequest(request?: { method?: string; path?: string }): string {
  return `${request?.method ?? '-'} ${request?.path ?? '-'}`;
}

// The stack's first line repeats the error message; frames follow it.
function stackFrames(stack?: string): string | undefined {
  return stack?.split('\n').slice(1).join('\n') || undefined;
}

// An HttpException thrown with `{ message, details }` exposes `details` as a
// machine-readable field, for example the conflicting order id.
function errorDetails(exception: unknown): Record<string, unknown> | null {
  if (!(exception instanceof HttpException)) return null;
  const body = exception.getResponse();
  if (typeof body !== 'object' || body === null) return null;
  const details = (body as { details?: unknown }).details;
  if (typeof details !== 'object' || details === null) return null;
  if (Array.isArray(details)) return null;
  return details as Record<string, unknown>;
}
