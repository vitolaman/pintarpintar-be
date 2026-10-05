import { BadRequestException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import {
  PasswordResetService,
  RESET_LINK_INVALID,
  RESET_REQUESTED,
} from './password-reset.service';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('PasswordResetService', () => {
  let manager: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    query: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
    queryRunner: { isTransactionActive: boolean };
  };
  let queued: Array<Record<string, unknown>>;
  let service: PasswordResetService;
  const user = () =>
    ({
      id: 'user-1',
      name: 'Ayu',
      email: 'ayu@example.test',
      passwordHash: 'old-hash',
      tokenVersion: 3,
    }) as User;

  beforeEach(() => {
    queued = [];
    const insert = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn((rows) => {
        queued.push(...rows);
        return insert;
      }),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };
    manager = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      query: jest.fn(),
      create: jest.fn((_target, value) => value),
      save: jest.fn(async (target, value) =>
        target === User ? value : { id: 'token-1', ...(value ?? target) },
      ),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => insert),
      queryRunner: { isTransactionActive: true },
    };
    const dataSource = {
      transaction: jest.fn((work) => work(manager)),
    } as unknown as DataSource;
    service = new PasswordResetService(dataSource);
  });

  describe('request', () => {
    it('answers the same way for an unknown address and queues nothing', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.request({ email: ' Nobody@Example.test ' }),
      ).resolves.toEqual({ data: null, responseMessage: RESET_REQUESTED });
      expect(manager.findOne).toHaveBeenCalledWith(User, {
        where: { email: 'nobody@example.test' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(queued).toHaveLength(0);
    });

    it('stores only the hash and emails the token, expiring with it', async () => {
      manager.findOne.mockResolvedValue(user());
      manager.query.mockImplementation(async (sql: string) =>
        sql.startsWith('SAVEPOINT') || sql.startsWith('RELEASE')
          ? []
          : [{ last_hour: 0, too_soon: false }],
      );
      const before = Date.now();

      await expect(
        service.request({ email: 'ayu@example.test' }),
      ).resolves.toEqual({ data: null, responseMessage: RESET_REQUESTED });

      const [[stored]] = manager.save.mock.calls;
      expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(queued).toHaveLength(1);
      const email = queued[0] as {
        kind: string;
        payload: { reset_token: string };
        expiresAt: Date;
      };
      expect(email.kind).toBe('password_reset');
      expect(email.payload.reset_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(sha256(email.payload.reset_token)).toBe(stored.tokenHash);
      expect(email.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + 60 * 60 * 1000 - 1000,
      );
    });

    it.each([
      ['within a minute of the last email', { last_hour: 1, too_soon: true }],
      ['after five emails this hour', { last_hour: 5, too_soon: false }],
    ])('queues nothing %s', async (_name, recent) => {
      manager.findOne.mockResolvedValue(user());
      manager.query.mockResolvedValue([recent]);

      await expect(
        service.request({ email: 'ayu@example.test' }),
      ).resolves.toEqual({ data: null, responseMessage: RESET_REQUESTED });
      expect(manager.save).not.toHaveBeenCalled();
      expect(queued).toHaveLength(0);
    });
  });

  describe('confirm', () => {
    const TOKEN = 'A'.repeat(43);

    it.each(['short', `${'A'.repeat(42)}!`, 'A'.repeat(44)])(
      'rejects the malformed token %j with the single message',
      async (token) => {
        await expect(
          service.confirm({ token, new_password: 'Local-pass-2' }),
        ).rejects.toThrow(new BadRequestException(RESET_LINK_INVALID));
        expect(manager.query).not.toHaveBeenCalled();
      },
    );

    it('rejects an unknown, expired or used token with the single message', async () => {
      manager.query.mockResolvedValue([]);

      await expect(
        service.confirm({ token: TOKEN, new_password: 'Local-pass-2' }),
      ).rejects.toThrow(new BadRequestException(RESET_LINK_INVALID));
      expect(manager.query.mock.calls[0][0]).toContain('FOR UPDATE OF token');
      expect(manager.query.mock.calls[0][1]).toEqual([sha256(TOKEN)]);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('sets the password, ends every session, uses every link and queues the notice', async () => {
      const account = user();
      manager.query.mockImplementation(async (sql: string) =>
        sql.includes('FROM password_reset_tokens')
          ? [{ user_id: 'user-1' }]
          : [],
      );
      manager.findOneOrFail.mockResolvedValue(account);

      await expect(
        service.confirm({ token: TOKEN, new_password: 'Local-pass-2' }),
      ).resolves.toEqual({ data: null, responseMessage: 'Password reset' });

      expect(await compare('Local-pass-2', account.passwordHash)).toBe(true);
      expect(account.tokenVersion).toBe(4);
      expect(manager.update).toHaveBeenCalledWith(
        PasswordResetToken,
        expect.objectContaining({ userId: 'user-1' }),
        { usedAt: expect.any(Function) },
      );
      expect(queued).toEqual([
        expect.objectContaining({
          kind: 'password_changed',
          dedupeKey: 'user:user-1:password:4',
          payload: expect.objectContaining({ via_reset: true }),
        }),
      ]);
    });
  });

  it('deletes tokens older than seven days', async () => {
    const remove = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 3 }),
    };
    const dataSource = {
      createQueryBuilder: jest.fn(() => remove),
    } as unknown as DataSource;

    await expect(
      new PasswordResetService(dataSource).deleteOldTokens(),
    ).resolves.toBe(3);
    expect(remove.from).toHaveBeenCalledWith(PasswordResetToken);
    expect(remove.where.mock.calls[0][0]).toContain("interval '7 days'");
  });
});
