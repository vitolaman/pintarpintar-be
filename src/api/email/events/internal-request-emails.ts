import { Logger } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { EntityManager } from 'typeorm';
import { CertificationRequest } from '~/api/certification-request/entities/certification-request.entity';
import { HelpTicket } from '~/api/help-ticket/entities/help-ticket.entity';
import { MerchantProRequest } from '~/api/merchant-pro-request/entities/merchant-pro-request.entity';
import { MerchantRegistrationRequest } from '~/api/merchant-registration-request/entities/merchant-registration-request.entity';
import { User } from '~/api/user/entities/user.entity';
import { queueEmail } from '../email-queue';

/** Where internal request emails go unless INTERNAL_NOTIFICATION_EMAIL overrides it. */
export const DEFAULT_INTERNAL_NOTIFICATION_EMAIL = 'info@pintarpintar.id';

const logger = new Logger('InternalRequestEmails');
let warnedInvalidSetting = false;

/**
 * INTERNAL_NOTIFICATION_EMAIL when it is one valid address, otherwise the
 * default, so production keeps its recipient without any setting. A value
 * that is set but invalid is logged once (name only, never the value).
 */
export function internalNotificationRecipient(
  configured: string | undefined = process.env.INTERNAL_NOTIFICATION_EMAIL,
): string {
  const value = configured?.trim() ?? '';
  if (!value) return DEFAULT_INTERNAL_NOTIFICATION_EMAIL;
  if (isEmail(value)) return value;
  if (!warnedInvalidSetting) {
    logger.warn(
      `INTERNAL_NOTIFICATION_EMAIL is not one valid email address; internal emails go to ${DEFAULT_INTERNAL_NOTIFICATION_EMAIL}`,
    );
    warnedInvalidSetting = true;
  }
  return DEFAULT_INTERNAL_NOTIFICATION_EMAIL;
}

function requester(
  request: { id: string; userId: string | null; created_at: Date },
  user: User | null,
) {
  return {
    request_id: request.id,
    requested_at: request.created_at.toISOString(),
    user_id: request.userId,
    user_name: user?.name ?? null,
    user_email: user?.email ?? null,
  };
}

export function queueInternalHelpTicketEmail(
  manager: EntityManager,
  ticket: HelpTicket,
  user: User | null,
): Promise<void> {
  return queueEmail(manager, {
    kind: 'internal_help_ticket',
    to: internalNotificationRecipient(),
    dedupeKey: `internal:help-ticket:${ticket.id}`,
    payload: {
      ...requester(ticket, user),
      ticket_type: ticket.ticketType,
      message: ticket.message,
    },
  });
}

export function queueInternalMerchantProRequestEmail(
  manager: EntityManager,
  request: MerchantProRequest,
  user: User,
): Promise<void> {
  return queueEmail(manager, {
    kind: 'internal_merchant_pro_request',
    to: internalNotificationRecipient(),
    dedupeKey: `internal:merchant-pro-request:${request.id}`,
    payload: { ...requester(request, user), message: request.message },
  });
}

export function queueInternalCertificationRequestEmail(
  manager: EntityManager,
  request: CertificationRequest,
  user: User,
): Promise<void> {
  return queueEmail(manager, {
    kind: 'internal_certification_request',
    to: internalNotificationRecipient(),
    dedupeKey: `internal:certification-request:${request.id}`,
    payload: {
      ...requester(request, user),
      organization_name: request.organizationName,
      organization_profile: request.organizationProfile,
      organization_email: request.organizationEmail,
      organization_phone: request.organizationPhone,
    },
  });
}

export function queueInternalMerchantRegistrationRequestEmail(
  manager: EntityManager,
  request: MerchantRegistrationRequest,
  user: User,
): Promise<void> {
  return queueEmail(manager, {
    kind: 'internal_merchant_registration_request',
    to: internalNotificationRecipient(),
    dedupeKey: `internal:merchant-registration-request:${request.id}`,
    payload: { ...requester(request, user), message: request.message },
  });
}
