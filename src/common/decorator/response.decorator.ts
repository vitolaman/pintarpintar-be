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
import { ResponseDto } from '../dto/response.dto-default';

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
        responseMessage: '$description',
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

export const EmptyResponse = (exceptions: Array<any> = [NotFoundException]) => {
  return applyDecorators(
    ApiException(() => [...exceptions, InternalServerErrorException], {
      template: {
        statusCode: '$status',
        responseMessage: '$description',
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
        responseMessage: '$description',
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
) => {
  return applyDecorators(
    ApiExtraModels(ResponsePaginatedDto),
    ApiExtraModels(ResponseMetaDto),
    ApiExtraModels(model),
    ApiException(() => [...exceptions, InternalServerErrorException], {
      template: {
        statusCode: '$status',
        responseMessage: '$description',
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
