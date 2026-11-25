import { Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { emailPreferenceKey } from '../email-preference-policy';
import { renderEmail, SENSITIVE_PAYLOAD_FIELDS } from '../templates';
import {
  DEFAULT_INTERNAL_NOTIFICATION_EMAIL,
  internalNotificationRecipient,
  queueInternalCertificationRequestEmail,
  queueInternalHelpTicketEmail,
  queueInternalMerchantProRequestEmail,
  queueInternalMerchantRegistrationRequestEmail,
} from './internal-request-emails';

describe('internal request notifications', () => {
  const createdAt = new Date('2026-11-07T10:00:00.000Z');
  const user = { id: 'user-1', name: 'Alice', email: 'alice@example.com' };
  let values: jest.Mock;
  let manager: EntityManager;
  const savedSetting = process.env.INTERNAL_NOTIFICATION_EMAIL;

  afterEach(() => {
    if (savedSetting === undefined) {
      delete process.env.INTERNAL_NOTIFICATION_EMAIL;
    } else {
      process.env.INTERNAL_NOTIFICATION_EMAIL = savedSetting;
    }
  });

  beforeEach(() => {
    delete process.env.INTERNAL_NOTIFICATION_EMAIL;
    values = jest.fn().mockReturnThis();
    const builder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values,
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    manager = { createQueryBuilder: jest.fn(() => builder) } as never;
  });

  it('queues anonymous help tickets with their type and message', async () => {
    await queueInternalHelpTicketEmail(
      manager,
      {
        id: 'ticket-1',
        userId: null,
        created_at: createdAt,
        ticketType: 'saran',
        message: '<b>Help</b>',
      } as never,
      null,
    );
    const row = values.mock.calls[0][0][0];
    expect(row).toMatchObject({
      kind: 'internal_help_ticket',
      recipientEmail: 'info@pintarpintar.id',
      recipientUserId: null,
      dedupeKey: 'internal:help-ticket:ticket-1',
      status: 'pending',
      payload: {
        request_id: 'ticket-1',
        requested_at: createdAt.toISOString(),
        user_id: null,
        user_name: null,
        user_email: null,
        ticket_type: 'saran',
        message: '<b>Help</b>',
      },
    });
    const rendered = renderEmail(row.kind, row.payload, {
      frontend: 'https://pintarpintar.id',
      api: 'https://api.pintarpintar.id',
    });
    expect(rendered.html).toContain('&lt;b&gt;Help&lt;/b&gt;');
    expect(rendered.html).not.toContain('<b>Help</b>');
    expect(rendered.text).toContain('<b>Help</b>');
  });

  it('queues Pro requests with the requester details', async () => {
    await queueInternalMerchantProRequestEmail(
      manager,
      {
        id: 'pro-1',
        userId: user.id,
        created_at: createdAt,
        message: null,
      } as never,
      user as never,
    );
    expect(values.mock.calls[0][0][0]).toMatchObject({
      kind: 'internal_merchant_pro_request',
      recipientEmail: 'info@pintarpintar.id',
      dedupeKey: 'internal:merchant-pro-request:pro-1',
      payload: {
        request_id: 'pro-1',
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        message: null,
      },
    });
  });

  it('queues certification requests with the organization details', async () => {
    await queueInternalCertificationRequestEmail(
      manager,
      {
        id: 'cert-1',
        userId: user.id,
        created_at: createdAt,
        organizationName: 'Organization',
        organizationProfile: null,
        organizationEmail: 'contact@example.com',
        organizationPhone: '6281234567890',
      } as never,
      user as never,
    );
    expect(values.mock.calls[0][0][0]).toMatchObject({
      kind: 'internal_certification_request',
      recipientEmail: 'info@pintarpintar.id',
      dedupeKey: 'internal:certification-request:cert-1',
      payload: {
        organization_name: 'Organization',
        organization_profile: null,
        organization_email: 'contact@example.com',
        organization_phone: '6281234567890',
      },
    });
  });

  it('queues merchant registration requests for the internal team', async () => {
    await queueInternalMerchantRegistrationRequestEmail(
      manager,
      {
        id: 'reg-1',
        userId: user.id,
        created_at: createdAt,
        message: 'Join',
      } as never,
      user as never,
    );
    expect(values.mock.calls[0][0][0]).toMatchObject({
      kind: 'internal_merchant_registration_request',
      recipientEmail: 'info@pintarpintar.id',
      dedupeKey: 'internal:merchant-registration-request:reg-1',
      payload: { user_id: user.id, message: 'Join' },
    });
  });

  it.each([
    'internal_help_ticket',
    'internal_merchant_pro_request',
    'internal_merchant_registration_request',
    'internal_certification_request',
  ] as const)('%s is not affected by user email preferences', (kind) => {
    expect(
      emailPreferenceKey({ kind, userId: user.id, payload: {} }),
    ).toBeNull();
    expect(SENSITIVE_PAYLOAD_FIELDS[kind]).toEqual(
      expect.arrayContaining(['user_name', 'user_email']),
    );
  });

  describe('recipient setting', () => {
    const queueAll = async () => {
      await queueInternalHelpTicketEmail(
        manager,
        {
          id: 'ticket-1',
          userId: null,
          created_at: createdAt,
          ticketType: 'saran',
          message: 'Help',
        } as never,
        null,
      );
      await queueInternalMerchantProRequestEmail(
        manager,
        { id: 'pro-1', userId: user.id, created_at: createdAt } as never,
        user as never,
      );
      await queueInternalCertificationRequestEmail(
        manager,
        { id: 'cert-1', userId: user.id, created_at: createdAt } as never,
        user as never,
      );
      await queueInternalMerchantRegistrationRequestEmail(
        manager,
        { id: 'reg-1', userId: user.id, created_at: createdAt } as never,
        user as never,
      );
      return values.mock.calls.map(([rows]) => rows[0].recipientEmail);
    };

    it('sends every internal email to info@pintarpintar.id when unset', async () => {
      expect(DEFAULT_INTERNAL_NOTIFICATION_EMAIL).toBe('info@pintarpintar.id');
      expect(await queueAll()).toEqual(Array(4).fill('info@pintarpintar.id'));
    });

    it('sends every internal email to INTERNAL_NOTIFICATION_EMAIL when set', async () => {
      process.env.INTERNAL_NOTIFICATION_EMAIL = '  dev-team@pintarpintar.id ';
      expect(await queueAll()).toEqual(
        Array(4).fill('dev-team@pintarpintar.id'),
      );
    });

    it('reads the setting when each email is queued', () => {
      expect(internalNotificationRecipient()).toBe('info@pintarpintar.id');
      process.env.INTERNAL_NOTIFICATION_EMAIL = 'ops@example.org';
      expect(internalNotificationRecipient()).toBe('ops@example.org');
    });

    it.each(['', '   '])('uses the default for a blank value %p', (value) => {
      expect(internalNotificationRecipient(value)).toBe('info@pintarpintar.id');
    });

    it('uses the default for an invalid value and warns once without the value', () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      try {
        for (const value of [
          'not-an-email',
          'a@example.org, b@example.org',
          'Team <team@example.org>',
        ]) {
          expect(internalNotificationRecipient(value)).toBe(
            'info@pintarpintar.id',
          );
        }
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('INTERNAL_NOTIFICATION_EMAIL');
        expect(warn.mock.calls[0][0]).not.toContain('not-an-email');
      } finally {
        warn.mockRestore();
      }
    });
  });
});
