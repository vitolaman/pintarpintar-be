import { ValidationPipeOptions } from '@nestjs/common';

/**
 * Request validation for the whole application. The global pipe uses it, and
 * so does every route pipe that chooses the DTO itself, so both reject the
 * same requests.
 */
export const VALIDATION_OPTIONS: ValidationPipeOptions = {
  transform: true,
  // An unknown field (a typo or an old name) is a 400 naming it, not
  // silently ignored.
  whitelist: true,
  forbidNonWhitelisted: true,
};
