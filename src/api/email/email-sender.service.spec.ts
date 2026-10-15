import { MailerService } from '@nestjs-modules/mailer';
import { DataSource } from 'typeorm';
import { EmailSenderService } from './email-sender.service';
import { EmailOutbox } from './entities/email-outbox.entity';
import { MailSettings } from './mail-settings';

const MINUTE = 60 * 1000;

function queued(overrides: Partial<EmailOutbox> = {}): EmailOutbox {
  return {
    id: 'email-1',
    kind: 'password_changed',
    recipientEmail: 'ayu@example.test',
    recipientUserId: 'user-1',
    dedupeKey: 'user:user-1:password:2',
    payload: {
      user_name: 'Ayu',
      email: 'ayu@example.test',
      changed_at: '2026-10-05T02:20:00Z',
    },
    status: 'sending',
    attempts: 0,
    ...overrides,
  } as EmailOutbox;
}

describe('EmailSenderService', () => {
  let claimManager: {
    createQueryBuilder: jest.Mock;
    query: jest.Mock;
    update: jest.Mock;
    findBy: jest.Mock;
  };
  let recorded: jest.Mock;
  let preferenceQuery: jest.Mock;
  let sendMail: jest.Mock;
  let missing: string[];
  let service: EmailSenderService;

  function claim(emails: EmailOutbox[], discarded = 0) {
    claimManager.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: discarded }),
    });
    claimManager.query.mockResolvedValue(emails.map(({ id }) => ({ id })));
    claimManager.findBy.mockResolvedValue(emails);
  }

  beforeEach(() => {
    claimManager = {
      createQueryBuilder: jest.fn(),
      query: jest.fn(),
      update: jest.fn(),
      findBy: jest.fn(),
    };
    recorded = jest.fn();
    preferenceQuery = jest.fn().mockResolvedValue([]);
    sendMail = jest.fn();
    missing = [];
    const dataSource = {
      transaction: jest.fn((work) => work(claimManager)),
      manager: { update: recorded, query: preferenceQuery },
    } as unknown as DataSource;
    const settings = {
      missing: () => missing,
      sender: 'Pintar Pintar <info@example.test>',
      frontendUrl: 'https://pintarpintar.id',
    } as unknown as MailSettings;
    service = new EmailSenderService(
      dataSource,
      { sendMail } as unknown as MailerService,
      settings,
    );
  });

  it('sends nothing and claims nothing while mail is not configured', async () => {
    missing = ['MAIL_HOST'];
    const warn = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);

    await service.sendBatch();
    await service.sendBatch();

    expect(claimManager.query).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('MAIL_HOST');
  });

  it('claims due emails with a lease, sends them and records success', async () => {
    claim([queued()], 2);

    const result = await service.sendBatch();

    expect(result).toEqual({ sent: 1, retried: 0, failed: 0, discarded: 2 });
    expect(claimManager.query.mock.calls[0][0]).toContain(
      'FOR UPDATE SKIP LOCKED',
    );
    expect(claimManager.update).toHaveBeenCalledWith(
      EmailOutbox,
      expect.anything(),
      expect.objectContaining({ status: 'sending' }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Pintar Pintar <info@example.test>',
        to: 'ayu@example.test',
        subject: 'Kata sandi akun Pintar Pintar kamu telah diubah',
        html: expect.stringContaining('ayu@example.test'),
        text: expect.stringContaining('ayu@example.test'),
      }),
    );
    expect(recorded).toHaveBeenCalledWith(
      EmailOutbox,
      { id: 'email-1' },
      expect.objectContaining({ status: 'sent', attempts: 1, lastError: null }),
    );
  });

  it.each([0, 2])(
    'discards an opted-out email before SMTP, with %s previous attempts',
    async (attempts) => {
      claim([
        queued({
          kind: 'application_submitted',
          attempts,
          payload: {
            applicant_name: 'Ayu',
            job_title: 'Mentor',
            store_name: 'Store',
          },
        }),
      ]);
      preferenceQuery.mockResolvedValue([
        { user_id: 'user-1', email_application_submitted: false },
      ]);
      expect(await service.sendBatch()).toEqual({
        sent: 0,
        retried: 0,
        failed: 0,
        discarded: 1,
      });
      expect(sendMail).not.toHaveBeenCalled();
      expect(recorded).toHaveBeenCalledWith(
        EmailOutbox,
        { id: 'email-1' },
        { status: 'discarded', lastError: null },
      );
    },
  );

  it('does not submit or mark mail sent if current preferences cannot be read', async () => {
    claim([queued({ kind: 'application_submitted' })]);
    preferenceQuery.mockRejectedValue(new Error('unavailable'));
    await expect(service.sendBatch()).rejects.toThrow('unavailable');
    expect(sendMail).not.toHaveBeenCalled();
    expect(recorded).not.toHaveBeenCalled();
    // The existing claim lease makes this row eligible again after recovery.
    expect(claimManager.update).toHaveBeenCalledWith(
      EmailOutbox,
      expect.anything(),
      expect.objectContaining({ status: 'sending' }),
    );
  });

  it('fails a malformed announcement instead of repeatedly aborting the entire batch', async () => {
    claim([
      queued({ kind: 'class_announcement', payload: { audience: 'invalid' } }),
      queued({ id: 'valid-security-notice' }),
    ]);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
    const result = await service.sendBatch();
    expect(result).toEqual({ sent: 1, failed: 1, retried: 0, discarded: 0 });
    expect(preferenceQuery).not.toHaveBeenCalled();
    expect(recorded).toHaveBeenCalledWith(
      EmailOutbox,
      { id: 'email-1' },
      expect.objectContaining({
        status: 'failed',
        attempts: 1,
        lastError: 'render: Invalid announcement email audience',
      }),
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('rechecks before each SMTP submission rather than caching an earlier batch choice', async () => {
    const payload = {
      applicant_name: 'Ayu',
      job_title: 'Mentor',
      store_name: 'Store',
    };
    claim([
      queued({ id: 'one', kind: 'application_submitted', payload }),
      queued({ id: 'two', kind: 'application_submitted', payload }),
    ]);
    preferenceQuery
      .mockResolvedValueOnce([
        { user_id: 'user-1', email_application_submitted: true },
      ])
      .mockResolvedValueOnce([
        { user_id: 'user-1', email_application_submitted: false },
      ]);
    expect(await service.sendBatch()).toEqual({
      sent: 1,
      retried: 0,
      failed: 0,
      discarded: 1,
    });
    expect(preferenceQuery).toHaveBeenCalledTimes(2);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('sends the claimed emails in their due order', async () => {
    const first = queued({ id: 'email-1', recipientEmail: 'one@example.test' });
    const second = queued({
      id: 'email-2',
      recipientEmail: 'two@example.test',
    });
    // The claim query returns due order; the lookup returns any order.
    claimManager.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    });
    claimManager.query.mockResolvedValue([
      { id: 'email-1' },
      { id: 'email-2' },
    ]);
    claimManager.findBy.mockResolvedValue([second, first]);

    await service.sendBatch();

    expect(claimManager.query.mock.calls[0][0]).toContain(
      'ORDER BY next_attempt_at, created_at, id',
    );
    expect(sendMail.mock.calls.map(([mail]) => mail.to)).toEqual([
      'one@example.test',
      'two@example.test',
    ]);
  });

  it('retries a temporary failure one minute later', async () => {
    claim([queued()]);
    sendMail.mockRejectedValue(
      Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' }),
    );
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    const before = Date.now();

    const result = await service.sendBatch();

    expect(result.retried).toBe(1);
    const [, , changes] = recorded.mock.calls[0];
    expect(changes).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastError: 'ETIMEDOUT: Connection timeout',
    });
    expect(changes.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(
      before + MINUTE,
    );
  });

  it('fails a permanent rejection at once', async () => {
    claim([queued()]);
    sendMail.mockRejectedValue(
      Object.assign(new Error('550 No such user'), {
        responseCode: 550,
        command: 'RCPT TO',
      }),
    );
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

    expect((await service.sendBatch()).failed).toBe(1);
    expect(recorded.mock.calls[0][2]).toMatchObject({
      status: 'failed',
      attempts: 1,
    });
  });

  it('fails after the sixth temporary failure', async () => {
    claim([queued({ attempts: 5 })]);
    sendMail.mockRejectedValue(new Error('socket hang up'));
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

    expect((await service.sendBatch()).failed).toBe(1);
    expect(recorded.mock.calls[0][2]).toMatchObject({
      status: 'failed',
      attempts: 6,
    });
  });

  it('removes the reset token from the stored email once sent', async () => {
    claim([
      queued({
        kind: 'password_reset',
        payload: {
          user_name: 'Ayu',
          reset_token: 'secret-token',
          expires_at: '2026-10-05T08:30:00Z',
        },
      }),
    ]);

    await service.sendBatch();

    const [, , changes] = recorded.mock.calls[0];
    expect(changes.status).toBe('sent');
    expect(changes.payload()).toBe("payload - ARRAY['reset_token']::text[]");
  });

  it('keeps other payloads when sent', async () => {
    claim([queued()]);
    await service.sendBatch();
    expect(recorded.mock.calls[0][2].payload).toBeUndefined();
  });

  it('keeps the reset token while a retry is pending', async () => {
    claim([
      queued({
        kind: 'password_reset',
        payload: {
          user_name: 'Ayu',
          reset_token: 'secret-token',
          expires_at: '2026-10-05T08:30:00Z',
        },
      }),
    ]);
    sendMail.mockRejectedValue(new Error('socket hang up'));
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

    await service.sendBatch();

    expect(recorded.mock.calls[0][2]).toMatchObject({ status: 'pending' });
    expect(recorded.mock.calls[0][2].payload).toBeUndefined();
  });

  it('fails an email it cannot render without sending it', async () => {
    claim([queued({ kind: 'not_a_kind' })]);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);

    expect((await service.sendBatch()).failed).toBe(1);
    expect(sendMail).not.toHaveBeenCalled();
    expect(recorded.mock.calls[0][2].lastError).toContain('unknown email kind');
  });
});
