import { applicationAccepted } from './application-accepted.template';
import { applicationRejected } from './application-rejected.template';
import { applicationSubmitted } from './application-submitted.template';
import { certificateIssued } from './certificate-issued.template';
import { interviewScheduled } from './interview-scheduled.template';
import { FrontendPath, layout, RenderedEmail } from './layout';
import {
  meetingCancelled,
  meetingCreated,
  meetingUpdated,
} from './meeting.template';
import {
  meetingMentorReminder,
  meetingReminder,
} from './meeting-reminder.template';
import { merchantBalanceSettled } from './merchant-balance-settled.template';
import { merchantInactivityWarning } from './merchant-inactivity-warning.template';
import { merchantItemsRemoved } from './merchant-items-removed.template';
import { merchantLevelResult } from './merchant-level-result.template';
import { merchantNewApplicant } from './merchant-new-applicant.template';
import { merchantNewSale } from './merchant-new-sale.template';
import { merchantWeeklyReport } from './merchant-weekly-report.template';
import { orderAwaitingPayment } from './order-awaiting-payment.template';
import { orderExpired } from './order-expired.template';
import { orderFailed } from './order-failed.template';
import { orderPaid } from './order-paid.template';
import type { EmailKind, EmailPayloads } from './payloads';
import { passwordChanged } from './password-changed.template';
import { passwordReset } from './password-reset.template';
import { payoutAccountChanged } from './payout-account-changed.template';
import { submissionGraded } from './submission-graded.template';
import type { EmailTemplate } from './template';
import {
  withdrawalFailed,
  withdrawalSucceeded,
} from './withdrawal-outcome.template';
import { withdrawalRequested } from './withdrawal-requested.template';

const TEMPLATES: { [K in EmailKind]: EmailTemplate<EmailPayloads[K]> } = {
  order_awaiting_payment: orderAwaitingPayment,
  order_paid: orderPaid,
  order_expired: orderExpired,
  order_failed: orderFailed,
  merchant_new_sale: merchantNewSale,
  merchant_weekly_report: merchantWeeklyReport,
  merchant_level_result: merchantLevelResult,
  merchant_inactivity_warning: merchantInactivityWarning,
  merchant_items_removed: merchantItemsRemoved,
  merchant_balance_settled: merchantBalanceSettled,
  withdrawal_requested: withdrawalRequested,
  withdrawal_succeeded: withdrawalSucceeded,
  withdrawal_failed: withdrawalFailed,
  merchant_new_applicant: merchantNewApplicant,
  payout_account_changed: payoutAccountChanged,
  password_changed: passwordChanged,
  password_reset: passwordReset,
  application_submitted: applicationSubmitted,
  interview_scheduled: interviewScheduled,
  application_accepted: applicationAccepted,
  application_rejected: applicationRejected,
  meeting_created: meetingCreated,
  meeting_updated: meetingUpdated,
  meeting_cancelled: meetingCancelled,
  meeting_reminder: meetingReminder,
  meeting_mentor_reminder: meetingMentorReminder,
  submission_graded: submissionGraded,
  certificate_issued: certificateIssued,
};

export const emailKinds = Object.keys(TEMPLATES) as EmailKind[];

/**
 * Payload fields that must not stay stored after delivery; they are removed
 * when the email is sent, failed or discarded.
 */
export const SENSITIVE_PAYLOAD_FIELDS: Partial<Record<EmailKind, string[]>> = {
  password_reset: ['reset_token'],
};

export function isEmailKind(kind: string): kind is EmailKind {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, kind);
}

/** Renders a queued email; `frontendUrl` has no trailing slash. */
export function renderEmail<K extends EmailKind>(
  kind: K,
  payload: EmailPayloads[K],
  frontendUrl: string,
): RenderedEmail {
  const template = TEMPLATES[kind] as EmailTemplate<EmailPayloads[K]>;
  const link = (path: FrontendPath) => `${frontendUrl}${path}`;
  return layout(template(payload, link), frontendUrl);
}

export type { EmailKind, EmailPayloads } from './payloads';
