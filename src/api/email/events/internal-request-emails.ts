import { EntityManager } from 'typeorm';
import { CertificationRequest } from '~/api/certification-request/entities/certification-request.entity';
import { HelpTicket } from '~/api/help-ticket/entities/help-ticket.entity';
import { MerchantProRequest } from '~/api/merchant-pro-request/entities/merchant-pro-request.entity';
import { MerchantRegistrationRequest } from '~/api/merchant-registration-request/entities/merchant-registration-request.entity';
import { User } from '~/api/user/entities/user.entity';
import { queueEmail } from '../email-queue';

const INTERNAL_RECIPIENT = 'info@pintarpintar.id';

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
    to: INTERNAL_RECIPIENT,
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
    to: INTERNAL_RECIPIENT,
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
    to: INTERNAL_RECIPIENT,
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
    to: INTERNAL_RECIPIENT,
    dedupeKey: `internal:merchant-registration-request:${request.id}`,
    payload: { ...requester(request, user), message: request.message },
  });
}
