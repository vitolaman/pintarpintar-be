import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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

// Why a class cannot be deleted yet; the service sends these, Swagger lists them.
export const CLASS_HAS_LEARNERS =
  'Archive this class instead: learners are enrolled';
export const CLASS_IN_PENDING_ORDER =
  'This class is in an unpaid order; try again after it is paid or expires';
export const CLASS_IN_ACTIVE_BUNDLE =
  'Remove this class from its active bundles before deleting it';

export const CLASS_DELETE_CONFLICTS = [
  CLASS_HAS_LEARNERS,
  CLASS_IN_PENDING_ORDER,
  CLASS_IN_ACTIVE_BUNDLE,
].map((message) => new ConflictException(message));
