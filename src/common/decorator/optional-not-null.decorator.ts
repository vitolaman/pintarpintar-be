import { ValidateIf } from 'class-validator';

/**
 * An optional field that cannot be cleared: omitting it is allowed, but null
 * is validated (and rejected) like any other value. `@IsOptional()` would
 * skip validation for null and let it reach a NOT NULL column.
 */
export const OptionalNotNull = () =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);
