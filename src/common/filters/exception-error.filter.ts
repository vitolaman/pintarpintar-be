import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class CustomHttpExceptionFilter implements ExceptionFilter {
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

    console.error('[Exception Filter]', {
      status,
      message,
      stack: exception.stack,
      exception: exception.toString(),
    });

    const errorResponse = {
      responseMessage: Array.isArray(message) ? message : [message],
      error: HttpStatus[status] || 'Internal Server Error',
      statusCode: status,
    };
    const details = errorDetails(exception);

    response
      .status(status)
      .json(details ? { ...errorResponse, details } : errorResponse);
  }
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
