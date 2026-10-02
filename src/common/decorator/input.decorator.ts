import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { OptionalNotNull } from './optional-not-null.decorator';

// Request inputs follow one set of rules, so a form can send what it holds:
// - optional text of a nullable column is cleared by "" or null;
// - text the data model requires rejects "", whitespace and null;
// - enum values match ignoring case and surrounding spaces;
// - a blank optional number or query filter means "not sent".
// Transforms leave values of the wrong type untouched so the validators
// reject them with 400 instead of the transform throwing.

type TextOptions = {
  max: number;
  min?: number;
  description?: string;
  example?: string;
};

/** Optional text that the client may clear: "" and null both become null. */
export const ClearableText = ({ max, min = 1, ...doc }: TextOptions) =>
  applyDecorators(
    ApiPropertyOptional({
      type: String,
      nullable: true,
      maxLength: max,
      ...doc,
    }),
    Transform(({ value }) => {
      if (value === null) return null;
      if (typeof value !== 'string') return value;
      return value.trim() || null;
    }),
    IsOptional(),
    IsString(),
    Length(min, max),
  );

/**
 * Text the data model requires. `optional` allows omitting it (an update),
 * but "", whitespace and null are still rejected.
 */
export const RequiredText = ({
  max,
  min = 1,
  optional = false,
  ...doc
}: TextOptions & { optional?: boolean }) =>
  applyDecorators(
    (optional ? ApiPropertyOptional : ApiProperty)({
      type: String,
      maxLength: max,
      ...doc,
    }),
    Transform(({ value }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    ...(optional ? [OptionalNotNull()] : []),
    IsString(),
    IsNotEmpty(),
    Length(min, max),
  );

/** Maps a value to its canonical spelling, ignoring case and outer spaces. */
export function canonicalValue<T extends string>(
  values: readonly T[],
  value: unknown,
): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  return (
    values.find((candidate) => candidate.toLowerCase() === lower) ?? trimmed
  );
}

type EnumOptions = {
  // 'required': must be sent; 'optional': may be omitted, not null;
  // 'nullable': may be omitted, and null or "" clears it;
  // 'filter': a query filter, where a blank value means no filter.
  presence?: 'required' | 'optional' | 'nullable' | 'filter';
  description?: string;
  example?: string;
  default?: string;
};

export const EnumInput = <T extends string>(
  values: readonly T[],
  { presence = 'required', ...doc }: EnumOptions = {},
) =>
  applyDecorators(
    (presence === 'required' ? ApiProperty : ApiPropertyOptional)({
      enum: values,
      ...(presence === 'nullable' ? { nullable: true } : {}),
      ...doc,
    }),
    Transform(({ value }) => {
      const blank =
        value === '' || (typeof value === 'string' && value.trim() === '');
      if (presence === 'nullable' && (value === null || blank)) {
        return null;
      }
      // A key that is sent blank would otherwise overwrite the field's
      // initializer, so the documented default is applied here.
      if (presence === 'filter' && blank) {
        return doc.default;
      }
      return canonicalValue(values, value);
    }),
    ...(presence === 'nullable' || presence === 'filter' ? [IsOptional()] : []),
    ...(presence === 'optional' ? [OptionalNotNull()] : []),
    IsIn(values),
  );

type NumberOptions = {
  presence?: 'required' | 'optional' | 'nullable';
  integer?: boolean;
  min?: number;
  max?: number;
  description?: string;
  example?: number;
  default?: number;
};

/**
 * A number that may also arrive as a numeric string (multipart forms, query
 * strings). A blank value means "not sent"; with `nullable`, null clears it.
 */
export const NumberInput = ({
  presence = 'required',
  integer = false,
  min,
  max,
  ...doc
}: NumberOptions = {}) =>
  applyDecorators(
    (presence === 'required' ? ApiProperty : ApiPropertyOptional)({
      type: integer ? 'integer' : Number,
      ...(presence === 'nullable' ? { nullable: true } : {}),
      ...(min !== undefined ? { minimum: min } : {}),
      ...(max !== undefined ? { maximum: max } : {}),
      ...doc,
    }),
    Transform(({ value }) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (trimmed === '') return undefined;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : value;
    }),
    ...(presence === 'nullable' ? [IsOptional()] : []),
    ...(presence === 'optional' ? [OptionalNotNull()] : []),
    integer ? IsInt() : IsNumber({ allowNaN: false, allowInfinity: false }),
    ...(min !== undefined ? [Min(min)] : []),
    ...(max !== undefined ? [Max(max)] : []),
  );

/** A query filter: blank means "no filter"; text is trimmed. */
export const QueryFilter = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return value.trim() || undefined;
  });
