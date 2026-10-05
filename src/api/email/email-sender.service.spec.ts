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
    sendMail = jest.fn();
    missing = [];
    const dataSource = {
      transaction: jest.fn((work) => work(claimManager)),
      manager: { update: recorded },
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
        subject: 'Kata sandi akun Pintar Pintar kamu diubah',
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

  it('fails an email it cannot render without sending it', async () => {
    claim([queued({ kind: 'not_a_kind' })]);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);

    expect((await service.sendBatch()).failed).toBe(1);
    expect(sendMail).not.toHaveBeenCalled();
    expect(recorded.mock.calls[0][2].lastError).toContain('unknown email kind');
  });
});
