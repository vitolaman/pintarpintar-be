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
  status: HttpStatus = HttpStatus.OK,
  exceptions: Array<any> = [NotFoundException],
) => {
  return applyDecorators(
    ApiExtraModels(ResponseDto),
    ApiExtraModels(model),
    ApiException(() => [...exceptions, InternalServerErrorException]),
    ApiResponse({
      status,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResponseDto) },
          {
            properties: {
              responseMessage: {
                type: 'string',
              },
              data: {
                type: 'object',
                $ref: getSchemaPath(model),
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
    ApiException(() => [...exceptions, InternalServerErrorException]),
    ApiResponse({
      status: HttpStatus.NO_CONTENT,
    }),
  );
};

export const PaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
  exceptions: Array<any> = [],
) => {
  return applyDecorators(
    ApiExtraModels(ResponsePaginatedDto),
    ApiExtraModels(ResponseMetaDto),
    ApiExtraModels(model),
    ApiException(() => [...exceptions, InternalServerErrorException]),
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
            },
          },
        ],
      },
    }),
  );
};
