import { UserNotificationPreferences } from '../merchant/entities/user-notification-preferences.entity';

export const EMAIL_PREFERENCE_FIELDS = {
  email_order_paid: 'emailOrderPaid',
  email_learner_announcement: 'emailLearnerAnnouncement',
  email_application_submitted: 'emailApplicationSubmitted',
  email_merchant_registered: 'emailMerchantRegistered',
  email_pro_paid: 'emailProPaid',
  email_interview_scheduled: 'emailInterviewScheduled',
  email_application_result: 'emailApplicationResult',
  email_mentor_announcement: 'emailMentorAnnouncement',
  email_new_sale: 'emailNewSale',
  email_new_applicant: 'emailNewApplicant',
  email_merchant_announcement: 'emailMerchantAnnouncement',
  email_cashflow_success: 'emailCashflowSuccess',
} as const satisfies Record<string, keyof UserNotificationPreferences>;

export const MERCHANT_PREFERENCE_FIELDS = {
  email_new_sale: 'emailNewSale',
  email_new_applicant: 'emailNewApplicant',
  email_merchant_announcement: 'emailMerchantAnnouncement',
  email_cashflow_success: 'emailCashflowSuccess',
  email_new_review: 'emailNewReview',
  email_weekly_report: 'emailWeeklyReport',
  whatsapp_new_order: 'whatsappNewOrder',
  whatsapp_payout_approved: 'whatsappPayoutApproved',
  whatsapp_student_chat: 'whatsappStudentChat',
  promotion_broadcast: 'promotionBroadcast',
} as const satisfies Record<string, keyof UserNotificationPreferences>;

export type EmailPreferenceKey = keyof typeof EMAIL_PREFERENCE_FIELDS;
export type MerchantPreferenceKey = keyof typeof MERCHANT_PREFERENCE_FIELDS;
export type PreferencePatch = Partial<
  Record<EmailPreferenceKey | MerchantPreferenceKey, boolean>
>;

export function preferenceValues<
  T extends Record<string, keyof UserNotificationPreferences>,
>(
  fields: T,
  preferences: UserNotificationPreferences | null,
): Record<keyof T, boolean> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, property]) => [
      key,
      preferences?.[property] ?? key !== 'whatsapp_student_chat',
    ]),
  ) as Record<keyof T, boolean>;
}
