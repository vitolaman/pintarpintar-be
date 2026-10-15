import { EntityManager } from 'typeorm';
import type { EmailKind } from './templates/payloads';
import {
  EMAIL_PREFERENCE_FIELDS,
  EmailPreferenceKey,
} from '../notification-preferences/preference-fields';

interface PreferenceRecipient {
  kind: string;
  userId?: string | null;
  payload: object;
}

const KIND_PREFERENCES = {
  order_paid: 'email_order_paid',
  application_submitted: 'email_application_submitted',
  merchant_registered: 'email_merchant_registered',
  pro_paid: 'email_pro_paid',
  interview_scheduled: 'email_interview_scheduled',
  application_accepted: 'email_application_result',
  application_rejected: 'email_application_result',
  merchant_new_sale: 'email_new_sale',
  merchant_new_applicant: 'email_new_applicant',
  merchant_balance_settled: 'email_cashflow_success',
  withdrawal_succeeded: 'email_cashflow_success',
} as const satisfies Partial<Record<EmailKind, EmailPreferenceKey>>;
const AUDIENCE_PREFERENCES: Record<string, EmailPreferenceKey> = {
  learner: 'email_learner_announcement',
  tutor: 'email_mentor_announcement',
  merchant: 'email_merchant_announcement',
};
const LOOKUP_BATCH_SIZE = 1000;

export function emailPreferenceKey(
  recipient: PreferenceRecipient,
): EmailPreferenceKey | null {
  if (recipient.kind === 'class_announcement') {
    const audience = (recipient.payload as { audience?: string }).audience;
    if (
      !audience ||
      !Object.prototype.hasOwnProperty.call(AUDIENCE_PREFERENCES, audience)
    ) {
      throw new Error('Invalid announcement email audience');
    }
    return AUDIENCE_PREFERENCES[audience];
  }
  return Object.prototype.hasOwnProperty.call(KIND_PREFERENCES, recipient.kind)
    ? KIND_PREFERENCES[recipient.kind as keyof typeof KIND_PREFERENCES]
    : null;
}

/** Missing rows mean enabled; lookup failures propagate so mail never bypasses an opt-out. */
export async function enabledEmailRecipients(
  manager: EntityManager,
  recipients: PreferenceRecipient[],
): Promise<boolean[]> {
  const keys = recipients.map(emailPreferenceKey);
  const ids = [
    ...new Set(
      recipients.flatMap((recipient, index) =>
        keys[index] && recipient.userId ? [recipient.userId] : [],
      ),
    ),
  ];
  const preferences = new Map<
    string,
    Partial<Record<EmailPreferenceKey, boolean>>
  >();
  for (let start = 0; start < ids.length; start += LOOKUP_BATCH_SIZE) {
    const rows: Array<
      { user_id: string } & Record<EmailPreferenceKey, boolean>
    > = await manager.query(
      `SELECT user_id, ${Object.keys(EMAIL_PREFERENCE_FIELDS).join(', ')}
       FROM user_notification_preferences WHERE user_id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [ids.slice(start, start + LOOKUP_BATCH_SIZE)],
    );
    for (const row of rows) preferences.set(row.user_id, row);
  }
  return recipients.map((recipient, index) => {
    const key = keys[index];
    return (
      !key ||
      !recipient.userId ||
      preferences.get(recipient.userId)?.[key] !== false
    );
  });
}
