import { EntityManager } from 'typeorm';
import {
  emailPreferenceKey,
  enabledEmailRecipients,
} from './email-preference-policy';
import { EMAIL_PREFERENCE_FIELDS } from '../notification-preferences/preference-fields';

const mapped = [
  ['order_paid', 'email_order_paid'],
  ['application_submitted', 'email_application_submitted'],
  ['merchant_registered', 'email_merchant_registered'],
  ['pro_paid', 'email_pro_paid'],
  ['interview_scheduled', 'email_interview_scheduled'],
  ['application_accepted', 'email_application_result'],
  ['application_rejected', 'email_application_result'],
  ['merchant_new_sale', 'email_new_sale'],
  ['merchant_new_applicant', 'email_new_applicant'],
  ['merchant_balance_settled', 'email_cashflow_success'],
  ['withdrawal_succeeded', 'email_cashflow_success'],
];
describe('Email preference policy', () => {
  const query = jest.fn();
  const manager = { query } as unknown as EntityManager;
  beforeEach(() => {
    query.mockReset().mockResolvedValue([]);
  });

  it.each(mapped)('maps %s only to %s', async (kind, key) => {
    const recipient = { kind, userId: 'account-1', payload: {} };
    expect(emailPreferenceKey(recipient)).toBe(key);
    query.mockResolvedValue([{ user_id: 'account-1', [key]: false }]);
    expect(await enabledEmailRecipients(manager, [recipient])).toEqual([false]);
    query.mockResolvedValue([{ user_id: 'account-1', [key]: true }]);
    expect(await enabledEmailRecipients(manager, [recipient])).toEqual([true]);
  });

  it.each([
    ['learner', 'email_learner_announcement'],
    ['tutor', 'email_mentor_announcement'],
    ['merchant', 'email_merchant_announcement'],
  ])('maps announcement context %s to %s', (audience, key) => {
    expect(
      emailPreferenceKey({ kind: 'class_announcement', payload: { audience } }),
    ).toBe(key);
  });

  it('leaves security/failure/reminder/weekly emails unchanged without lookup', async () => {
    const kinds = [
      'password_changed',
      'password_reset',
      'order_failed',
      'order_expired',
      'order_awaiting_payment',
      'withdrawal_failed',
      'withdrawal_requested',
      'pro_failed',
      'pro_expiring',
      'merchant_weekly_report',
      'meeting_created',
    ];
    expect(
      await enabledEmailRecipients(
        manager,
        kinds.map((kind) => ({ kind, userId: 'account-1', payload: {} })),
      ),
    ).toEqual(kinds.map(() => true));
    expect(query).not.toHaveBeenCalled();
  });

  it('treats missing rows as enabled and batches distinct account lookups', async () => {
    const recipients = Array.from({ length: 1501 }, (_, i) => ({
      kind: 'order_paid',
      userId: `account-${i}`,
      payload: {},
    }));
    expect(
      (
        await enabledEmailRecipients(manager, [...recipients, recipients[0]])
      ).every(Boolean),
    ).toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.map(([, [ids]]) => ids.length)).toEqual([
      1000, 501,
    ]);
    expect(query.mock.calls[0][0]).toContain('ANY($1::uuid[])');
  });

  it('does not use recipient contact addresses to find preferences', async () => {
    query.mockResolvedValue([
      { user_id: 'applicant-account', email_application_result: false },
    ]);
    expect(
      await enabledEmailRecipients(manager, [
        {
          kind: 'application_rejected',
          userId: 'applicant-account',
          payload: { email: 'different@example.test' },
        },
      ]),
    ).toEqual([false]);
    expect(query.mock.calls[0][1]).toEqual([['applicant-account']]);
  });

  it('propagates lookup failures instead of assuming enabled', async () => {
    query.mockRejectedValue(new Error('unavailable'));
    await expect(
      enabledEmailRecipients(manager, [
        { kind: 'order_paid', userId: 'account-1', payload: {} },
      ]),
    ).rejects.toThrow('unavailable');
  });

  it('covers all twelve defined switches and rejects an invalid announcement context', () => {
    const used = [
      ...mapped.map(([, key]) => key),
      'email_learner_announcement',
      'email_mentor_announcement',
      'email_merchant_announcement',
    ];
    expect([...new Set(used)].sort()).toEqual(
      Object.keys(EMAIL_PREFERENCE_FIELDS).sort(),
    );
    expect(() =>
      emailPreferenceKey({
        kind: 'class_announcement',
        payload: { audience: 'unknown' },
      }),
    ).toThrow('Invalid announcement email audience');
  });
});
