import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CustomHttpExceptionFilter } from './exception-error.filter';

describe('CustomHttpExceptionFilter', () => {
  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    json = jest.fn();
    status = jest.fn(() => ({ json }));
    host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => jest.restoreAllMocks());

  const respond = (exception: unknown) => {
    new CustomHttpExceptionFilter().catch(exception, host);
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
});
