import type { EmailLine } from './layout';

// The data each email shows, captured when the email is queued. Times are ISO
// strings and amounts are numbers, because the payload is stored as JSON.

interface OrderEmail {
  order_number: string;
  buyer_name: string;
  items: EmailLine[];
  discount_amount: number;
  total_amount: number;
}

export interface OrderAwaitingPaymentEmail extends OrderEmail {
  expires_at: string;
  payment_url: string;
}

export interface OrderPaidEmail extends OrderEmail {
  paid_at: string;
  payment_method: string | null;
}

export type OrderClosedEmail = OrderEmail;

export interface MerchantNewSaleEmail {
  order_number: string;
  buyer_name: string;
  owner_name: string;
  store_name: string;
  paid_at: string;
  items: EmailLine[];
  net_total: number;
  // YYYY-MM-DD in Asia/Jakarta.
  settlement_date: string | null;
}

export type MerchantLevel = 'basic' | 'silver' | 'gold';

export interface MerchantLevelResultEmail {
  owner_name: string;
  store_name: string;
  // YYYY-MM.
  month: string;
  revenue: number;
  level_before: MerchantLevel;
  level_after: MerchantLevel;
}

export interface MerchantInactivityWarningEmail {
  owner_name: string;
  store_name: string;
  quiet_months: [string, string];
  deadline_month: string;
}

export interface MerchantItemsRemovedEmail {
  owner_name: string;
  store_name: string;
  removed_count: number;
}

export interface WithdrawalRequestedEmail {
  owner_name: string;
  store_name: string;
  amount: number;
  fee_amount: number;
  bank_name: string;
  masked_account_number: string;
  account_holder_name: string;
  requested_at: string;
}

export type PayoutAccountAction = 'added' | 'updated' | 'deleted' | 'primary';

export interface PayoutAccountChangedEmail {
  owner_name: string;
  store_name: string;
  action: PayoutAccountAction;
  bank_name: string;
  masked_account_number: string;
  account_holder_name: string;
  changed_at: string;
}

export interface PasswordChangedEmail {
  user_name: string;
  email: string;
  changed_at: string;
}

export interface ApplicationEmail {
  applicant_name: string;
  job_title: string;
  store_name: string;
}

export interface InterviewScheduledEmail extends ApplicationEmail {
  interview_at: string;
  interview_url: string | null;
  rescheduled: boolean;
}

export interface ApplicationAcceptedEmail extends ApplicationEmail {
  class_title: string | null;
}

export interface MeetingEmail {
  learner_name: string;
  class_title: string;
  meeting_title: string;
  starts_at: string;
  previous_starts_at: string | null;
  duration_minutes: number;
  live_url: string | null;
}

export interface SubmissionGradedEmail {
  learner_name: string;
  class_title: string;
  assignment_title: string;
  score: number;
  max_score: number | null;
  graded_at: string;
  feedback: string | null;
}

export interface CertificateIssuedEmail {
  learner_name: string;
  class_title: string;
  certificate_number: string;
  store_name: string;
  issued_at: string;
}

/** Every email kind and the payload its template takes. */
export interface EmailPayloads {
  order_awaiting_payment: OrderAwaitingPaymentEmail;
  order_paid: OrderPaidEmail;
  order_expired: OrderClosedEmail;
  order_failed: OrderClosedEmail;
  merchant_new_sale: MerchantNewSaleEmail;
  merchant_level_result: MerchantLevelResultEmail;
  merchant_inactivity_warning: MerchantInactivityWarningEmail;
  merchant_items_removed: MerchantItemsRemovedEmail;
  withdrawal_requested: WithdrawalRequestedEmail;
  payout_account_changed: PayoutAccountChangedEmail;
  password_changed: PasswordChangedEmail;
  application_submitted: ApplicationEmail;
  interview_scheduled: InterviewScheduledEmail;
  application_accepted: ApplicationAcceptedEmail;
  application_rejected: ApplicationEmail;
  meeting_created: MeetingEmail;
  meeting_updated: MeetingEmail;
  meeting_cancelled: MeetingEmail;
  submission_graded: SubmissionGradedEmail;
  certificate_issued: CertificateIssuedEmail;
}

export type EmailKind = keyof EmailPayloads;
