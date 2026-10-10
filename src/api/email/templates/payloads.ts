import type { EmailLine, ItemType } from './layout';

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

export interface WeeklyTopItem {
  title: string;
  type: ItemType;
  amount: number;
  sold: number;
}

export interface MerchantWeeklyReportEmail {
  owner_name: string;
  store_name: string;
  // Monday and Sunday of the reported week (YYYY-MM-DD, Asia/Jakarta).
  week_start: string;
  week_end: string;
  revenue: number;
  previous_revenue: number;
  transactions: number;
  buyers: number;
  top_items: WeeklyTopItem[];
  new_reviews: number;
  average_rating: number | null;
  withdrawable_balance: number;
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

export interface MerchantBalanceSettledEmail {
  owner_name: string;
  store_name: string;
  amount: number;
  order_count: number;
  settled_at: string;
}

export interface WithdrawalOutcomeEmail {
  owner_name: string;
  store_name: string;
  amount: number;
  fee_amount: number;
  // As stored on the withdrawal: bank, masked number and holder.
  destination: string;
  requested_at: string;
}

export interface ProExpiryEmail {
  owner_name: string;
  store_name: string;
  // YYYY-MM-DD in Asia/Jakarta: the date the merchant is told Pro ends.
  end_date: string;
}

export interface MerchantNewApplicantEmail {
  owner_name: string;
  store_name: string;
  applicant_name: string;
  job_title: string;
  applied_at: string;
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
  // True when the password was set through a reset link.
  via_reset?: boolean;
}

export interface PasswordResetEmail {
  user_name: string;
  // Removed from the stored email once it is sent, failed or discarded.
  reset_token?: string;
  expires_at: string;
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
  // The time before a reschedule; absent in emails queued before it existed.
  previous_interview_at?: string | null;
}

export interface ApplicationAcceptedEmail extends ApplicationEmail {
  class_title: string | null;
}

export interface MeetingEmail {
  // The recipient's name: the learner, or the mentor in a mentor reminder.
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
  merchant_weekly_report: MerchantWeeklyReportEmail;
  merchant_level_result: MerchantLevelResultEmail;
  merchant_inactivity_warning: MerchantInactivityWarningEmail;
  merchant_items_removed: MerchantItemsRemovedEmail;
  merchant_balance_settled: MerchantBalanceSettledEmail;
  withdrawal_requested: WithdrawalRequestedEmail;
  withdrawal_succeeded: WithdrawalOutcomeEmail;
  withdrawal_failed: WithdrawalOutcomeEmail;
  merchant_new_applicant: MerchantNewApplicantEmail;
  pro_expiring: ProExpiryEmail;
  pro_not_renewed: ProExpiryEmail;
  pro_ended: ProExpiryEmail;
  payout_account_changed: PayoutAccountChangedEmail;
  password_changed: PasswordChangedEmail;
  password_reset: PasswordResetEmail;
  application_submitted: ApplicationEmail;
  interview_scheduled: InterviewScheduledEmail;
  application_accepted: ApplicationAcceptedEmail;
  application_rejected: ApplicationEmail;
  meeting_created: MeetingEmail;
  meeting_updated: MeetingEmail;
  meeting_cancelled: MeetingEmail;
  meeting_reminder: MeetingEmail;
  meeting_mentor_reminder: MeetingEmail;
  submission_graded: SubmissionGradedEmail;
  certificate_issued: CertificateIssuedEmail;
}

export type EmailKind = keyof EmailPayloads;
