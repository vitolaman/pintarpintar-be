import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClassAction, ClassArea } from './class-permissions';

// Swagger examples of the errors class routes answer, with the messages that
// ClassAccessService and the class services send. A class the caller does
// not own and is not assigned to is reported as not found.
export const CLASS_NOT_FOUND = new NotFoundException('Class not found');

export const OWNER_ONLY = new ForbiddenException(
  'Only the class owner can do this',
);

export function notFound(message: string): NotFoundException {
  return new NotFoundException(message);
}

export function tutorLacks(
  area: ClassArea,
  action: ClassAction,
): ForbiddenException {
  return new ForbiddenException(
    `Tutor permission ${area}.${action} is required`,
  );
}
