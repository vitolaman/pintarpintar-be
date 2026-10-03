import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { QueryFilter } from '../decorator/input.decorator';

export const DEFAULT_PAGE_LIMIT = 10;
export const MAX_PAGE_LIMIT = 100;
// Bounds the OFFSET so an absurd page number cannot overflow the query.
const MAX_PAGE = 1_000_000;

// Paging values are clamped rather than rejected: a blank, missing or
// non-numeric value means the fallback, and an out-of-range value the nearest
// bound, so no paging input can fail a request.
export function clampInteger(
  value: unknown,
  fallback: number | undefined,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return fallback;
  }
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

export const PageQuery = () =>
  applyDecorators(
    ApiPropertyOptional({
      type: Number,
      default: 1,
      minimum: 1,
      description:
        'Page number. A blank or non-numeric value means 1, and a value below 1 is clamped to 1.',
    }),
    Transform(({ value }) => clampInteger(value, 1, 1, MAX_PAGE)),
    IsOptional(),
    IsInt(),
  );

type LimitQueryOptions = {
  // `undefined` leaves the limit unset when it is blank, for lists that
  // return everything unless a limit is sent.
  defaultLimit?: number | undefined;
  maxLimit?: number;
  description?: string;
};

export const LimitQuery = (options: LimitQueryOptions = {}) => {
  const defaultLimit =
    'defaultLimit' in options ? options.defaultLimit : DEFAULT_PAGE_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_PAGE_LIMIT;
  const blankValue =
    defaultLimit === undefined
      ? ''
      : ` A blank or non-numeric value means ${defaultLimit}.`;
  const limitRules = `Values outside 1–${maxLimit} are clamped.${blankValue}`;
  return applyDecorators(
    ApiPropertyOptional({
      type: Number,
      default: defaultLimit,
      minimum: 1,
      maximum: maxLimit,
      description: options.description
        ? `${options.description} ${limitRules}`
        : `Items per page. ${limitRules}`,
    }),
    Transform(({ value }) => clampInteger(value, defaultLimit, 1, maxLimit)),
    IsOptional(),
    IsInt(),
  );
};

export class RequestPaginatedQueryDto {
  @PageQuery()
  page?: number = 1;

  @LimitQuery()
  limit?: number = DEFAULT_PAGE_LIMIT;
}

export class RequestPaginatedQueryWithSearchDto extends RequestPaginatedQueryDto {
  @ApiPropertyOptional({ description: 'A blank value means no search' })
  @QueryFilter()
  @IsOptional()
  @IsString()
  search?: string;
}
