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
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  PHONE_MAX_DIGITS,
  PHONE_MIN_DIGITS,
  STORED_PHONE,
  normalizePhone,
} from '../phone/phone-number';
import { OptionalNotNull } from './optional-not-null.decorator';

// Request inputs follow one set of rules, so a form can send what it holds:
// - optional text of a nullable column is cleared by "" or null;
// - text the data model requires rejects "", whitespace and null;
// - enum values match ignoring case and surrounding spaces;
// - a form label is plain text: markup and control characters are removed;
// - a phone number is stored as digits with its country code (62… for
//   Indonesian numbers);
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

type PhoneOptions = {
  // 'required': must be sent; 'optional': may be omitted, not null;
  // 'nullable': may be omitted, and null or "" clears it.
  presence?: 'required' | 'optional' | 'nullable';
  description?: string;
};

/**
 * A phone number, stored as digits with its country code: "0812-3456-7890",
 * "+62 812 3456 7890" and "812 3456 7890" all become "6281234567890", and
 * "+65 9123 4567" becomes "6591234567". A value that is not a phone number is
 * left as sent, so the length check rejects it.
 */
export const PhoneInput = ({
  presence = 'required',
  description,
}: PhoneOptions = {}) =>
  applyDecorators(
    (presence === 'required' ? ApiProperty : ApiPropertyOptional)({
      type: String,
      example: '6281234567890',
      ...(presence === 'nullable' ? { nullable: true } : {}),
      description: [
        description,
        `Any common format (0812-3456-7890, +62 812 3456 7890, +65 …); stored and returned as ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits with the country code, e.g. 6281234567890`,
      ]
        .filter(Boolean)
        .join('. '),
    }),
    Transform(({ value }) => {
      if (typeof value !== 'string') return value;
      if (presence === 'nullable' && value.trim() === '') return null;
      return normalizePhone(value) ?? value;
    }),
    ...(presence === 'nullable' ? [IsOptional()] : []),
    ...(presence === 'optional' ? [OptionalNotNull()] : []),
    IsString(),
    Matches(STORED_PHONE, {
      message: ({ property }) =>
        `${property} must be a phone number of ${PHONE_MIN_DIGITS} to ${PHONE_MAX_DIGITS} digits`,
    }),
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

type LabelOptions = {
  // 'required': must be sent; 'optional': may be omitted, not null;
  // 'nullable': may be omitted, and null or "" clears it.
  presence?: 'required' | 'optional' | 'nullable';
  max: number;
  description?: string;
  example?: string;
};

const HTML_TAG = /<[^>]*>/g;
const ANGLE_BRACKET = /[<>]/g;
const CONTROL_CHARACTER = /\p{Cc}/gu;

/** Plain text of a label: tags, stray angle brackets and control characters removed. */
export function plainLabel(value: string): string {
  return value
    .replace(HTML_TAG, '')
    .replace(ANGLE_BRACKET, '')
    .replace(CONTROL_CHARACTER, '')
    .trim();
}

/**
 * The label of a form choice, stored as the form sends it while the forms
 * still change (no fixed list). Markup is removed rather than rejected, so
 * the label is safe wherever it is shown; the length is checked afterwards.
 */
export const FormLabel = ({
  presence = 'required',
  max,
  ...doc
}: LabelOptions) =>
  applyDecorators(
    (presence === 'required' ? ApiProperty : ApiPropertyOptional)({
      type: String,
      maxLength: max,
      ...(presence === 'nullable' ? { nullable: true } : {}),
      ...doc,
    }),
    Transform(({ value }) => {
      if (typeof value !== 'string') return value;
      const label = plainLabel(value);
      return presence === 'nullable' ? label || null : label;
    }),
    ...(presence === 'nullable' ? [IsOptional()] : []),
    ...(presence === 'optional' ? [OptionalNotNull()] : []),
    IsString(),
    IsNotEmpty(),
    Length(1, max),
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
