import { ApiException } from '@nanogiants/nestjs-swagger-api-exception-decorator';
import {
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Type,
  applyDecorators,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ResponseMetaDto } from '../dto/response-meta.dto';
import { ResponsePaginatedDto } from '../dto/response-paginated.dto-default';
import { ResponseArrayDto, ResponseDto } from '../dto/response.dto-default';

export const DefaultResponse = <TModel extends Type<any>>(
  model: TModel,
  responseMessage: string,
  status: HttpStatus = HttpStatus.OK,
  exceptions: Array<any> = [NotFoundException],
) => {
  return applyDecorators(
    ApiExtraModels(ResponseDto),
    ApiExtraModels(model),
    ApiException(() => [...exceptions, InternalServerErrorException], {
      template: {
        statusCode: '$status',
        responseMessage: ['$description'],
        error: '$error',
      },
    }),
    ApiResponse({
      status,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResponseDto) },
          {
            properties: {
              data: {
                type: 'object',
                $ref: getSchemaPath(model),
              },
              responseMessage: {
                type: 'string',
                example: responseMessage,
              },
            },
          },
        ],
      },
    }),
  );
};

/** A 200 response that carries only a message, with `data: null`. */
export const MessageResponse = (
  responseMessage: string,
  exceptions: Array<any> = [],
) => {
  return applyDecorators(
    ApiException(() => [...exceptions, InternalServerErrorException], {
      template: {
        statusCode: '$status',
        responseMessage: ['$description'],
        error: '$error',
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      schema: {
        type: 'object',
        required: ['data', 'responseMessage'],
        properties: {
          data: { type: 'object', nullable: true, example: null },
          responseMessage: { type: 'string', example: responseMessage },
        },
      },
    }),
  );
};

export const EmptyResponse = (exceptions: Array<any> = [NotFoundException]) => {
  return applyDecorators(
    ApiException(() => [...exceptions, InternalServerErrorException], {
      template: {
        statusCode: '$status',
        responseMessage: ['$description'],
        error: '$error',
      },
    }),
    ApiResponse({
      status: HttpStatus.NO_CONTENT,
    }),
  );
};

export const PaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
  responseMessage: string,
  exceptions: Array<any> = [],
) => {
  return applyDecorators(
    ApiExtraModels(ResponsePaginatedDto),
    ApiExtraModels(ResponseMetaDto),
    ApiExtraModels(model),
    ApiException(() => [...exceptions, InternalServerErrorException], {
      template: {
        statusCode: '$status',
        responseMessage: ['$description'],
        error: '$error',
      },
    }),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResponsePaginatedDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              meta: {
                type: 'object',
                $ref: getSchemaPath(ResponseMetaDto),
              },
              responseMessage: {
                type: 'string',
                example: responseMessage,
              },
            },
          },
        ],
      },
    }),
  );
};

export const ArrayResponse = <TModel extends Type<any>>(
  model: TModel,
  responseMessage: string,
  exceptions: Array<any> = [],
  status: HttpStatus = HttpStatus.OK,
) => {
  return applyDecorators(
    ApiExtraModels(ResponseArrayDto),
    ApiExtraModels(model),
    ApiException(() => [...exceptions, InternalServerErrorException], {
      template: {
        statusCode: '$status',
        responseMessage: ['$description'],
        error: '$error',
      },
    }),
    ApiResponse({
      status,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResponseArrayDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
              responseMessage: {
                type: 'string',
                example: responseMessage,
              },
            },
          },
        ],
      },
    }),
  );
};

// For paginated responses whose list sits inside an object, for example
// `{ data: { counts, applications }, meta }`.
export const PaginatedObjectResponse = <TModel extends Type<any>>(
  model: TModel,
  responseMessage: string,
  exceptions: Array<any> = [],
) => {
  return applyDecorators(
    ApiExtraModels(ResponsePaginatedDto),
    ApiExtraModels(ResponseMetaDto),
    ApiExtraModels(model),
    ApiException(() => [...exceptions, InternalServerErrorException], {
      template: {
        statusCode: '$status',
        responseMessage: ['$description'],
        error: '$error',
      },
    }),
    ApiOkResponse({
      schema: {
        required: ['data', 'meta', 'responseMessage'],
        properties: {
          data: { $ref: getSchemaPath(model) },
          meta: { $ref: getSchemaPath(ResponseMetaDto) },
          responseMessage: {
            type: 'string',
            example: responseMessage,
          },
        },
      },
    }),
  );
};
