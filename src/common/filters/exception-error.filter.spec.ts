import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CustomHttpExceptionFilter } from './exception-error.filter';

describe('CustomHttpExceptionFilter', () => {
  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    json = jest.fn();
    status = jest.fn(() => ({ json }));
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'GET', path: '/api/v1/orders/o1' }),
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => jest.restoreAllMocks());

  const respond = (exception: unknown, sanitizeDatabaseErrors = false) => {
    new CustomHttpExceptionFilter({ sanitizeDatabaseErrors }).catch(
      exception,
      host,
    );
    return { status: status.mock.calls[0][0], body: json.mock.calls[0][0] };
  };

  it('gives a plain HttpException one message and no errors list', () => {
    expect(respond(new BadRequestException('Item is not available'))).toEqual({
      status: 400,
      body: {
        responseMessage: 'Item is not available',
        error: 'BAD_REQUEST',
        statusCode: 400,
      },
    });
  });

  it('lists every validation reason and leads with the first', () => {
    const { body } = respond(
      new BadRequestException([
        'name should not be empty',
        'email must be an email',
      ]),
    );
    expect(body.responseMessage).toBe('name should not be empty');
    expect(body.errors).toEqual([
      'name should not be empty',
      'email must be an email',
    ]);
    expect(body).not.toHaveProperty('details');
  });

  it('passes through a details object', () => {
    const { status: code, body } = respond(
      new ConflictException({
        message: 'Item x is awaiting payment in order o1',
        details: { order_id: 'o1' },
      }),
    );
    expect(code).toBe(409);
    expect(body).toEqual({
      responseMessage: 'Item x is awaiting payment in order o1',
      error: 'CONFLICT',
      statusCode: 409,
      details: { order_id: 'o1' },
    });
  });

  it.each([
    ['a string', 'o1'],
    ['an array', ['o1']],
    ['null', null],
  ])('ignores details that are %s', (_case, details) => {
    const { body } = respond(
      new HttpException({ message: 'Conflict', details }, HttpStatus.CONFLICT),
    );
    expect(body).not.toHaveProperty('details');
  });

  it('hides unexpected errors behind a 500', () => {
    expect(respond(new Error('connection refused'))).toEqual({
      status: 500,
      body: {
        responseMessage: 'Internal server error',
        error: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
      },
    });
  });

  describe('logging', () => {
    it('logs a client error as one warning line without a stack', () => {
      respond(new NotFoundException('Order not found'));

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '404 GET /api/v1/orders/o1: Order not found',
      );
      expect(error).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('logs the first validation message', () => {
      respond(
        new BadRequestException([
          'name should not be empty',
          'email must be an email',
        ]),
      );

      expect(warn).toHaveBeenCalledWith(
        '400 GET /api/v1/orders/o1: name should not be empty',
      );
    });

    it('logs the path without the query string', () => {
      host = {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
          getRequest: () => ({
            method: 'GET',
            path: '/api/v1/catalog/items',
            originalUrl: '/api/v1/catalog/items?search=ayu@example.test',
          }),
        }),
      } as unknown as ArgumentsHost;

      respond(new BadRequestException('search must be shorter'));

      expect(JSON.stringify(warn.mock.calls)).not.toContain('ayu@example.test');
      expect(warn).toHaveBeenCalledWith(
        '400 GET /api/v1/catalog/items: search must be shorter',
      );
    });

    it('logs a server error with its stack', () => {
      const failure = new TypeError('cannot read x');

      respond(failure);

      expect(error).toHaveBeenCalledWith(
        '500 GET /api/v1/orders/o1: TypeError: cannot read x',
        failure.stack,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('logs a database error by code and frames in production, without values', () => {
      const failure = new QueryFailedError(
        'SELECT * FROM orders WHERE id = $1',
        ['x1'],
        Object.assign(new Error('invalid input syntax for type uuid: "x1"'), {
          code: '22P02',
        }),
      );

      const { body } = respond(failure, true);

      const [line, frames] = error.mock.calls[0];
      expect(line).toBe(
        '500 GET /api/v1/orders/o1: QueryFailedError (code 22P02)',
      );
      expect(`${line}${frames}`).not.toContain('x1');
      expect(frames).toContain('    at ');
      expect(body.responseMessage).toBe('Internal server error');
    });

    it('keeps the database message outside production', () => {
      const failure = new QueryFailedError(
        'SELECT 1',
        [],
        Object.assign(new Error('invalid input syntax for type uuid: "x1"'), {
          code: '22P02',
        }),
      );

      respond(failure, false);

      expect(error.mock.calls[0][0]).toContain(
        'invalid input syntax for type uuid: "x1"',
      );
    });
  });
});
