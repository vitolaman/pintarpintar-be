import { EntityManager } from 'typeorm';
// TODO: Implement pro subscription email notifications similar to order emails
// This would require creating email templates and payloads for:
// - pro_subscription_awaiting_payment
// - pro_subscription_paid
// - pro_subscription_failed

export async function queueProSubscriptionAwaitingPaymentEmail(
  manager: EntityManager,
  transactionId: string,
): Promise<void> {
  // TODO: Implement email notification
}

export async function queueProSubscriptionPaidEmails(
  manager: EntityManager,
  transactionId: string,
): Promise<void> {
  // TODO: Implement email notification
}

export async function queueProSubscriptionFailedEmails(
  manager: EntityManager,
  transactionId: string,
): Promise<void> {
  // TODO: Implement email notification
}
