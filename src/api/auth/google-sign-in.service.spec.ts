import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import { AuthService } from './auth.service';
import { GoogleIdTokenVerifier } from './google-id-token.verifier';
import { SignInFailures } from './sign-in-failures';
import {
  EMAIL_LINKED_TO_OTHER_GOOGLE_ACCOUNT,
  GOOGLE_ACCOUNT_LINKED_ELSEWHERE,
  GOOGLE_ALREADY_LINKED,
  googleAccountName,
  GoogleSignInService,
  PASSWORD_ACCOUNT_EXISTS,
  PASSWORD_ACCOUNT_EXISTS_MESSAGE,
} from './google-sign-in.service';

const identity = {
  uid: 'firebase-uid-1',
  email: 'ana.learner@gmail.com',
  name: 'Ana Learner',
};

const account = (overrides: Partial<User> = {}) =>
  ({
    id: '9a2b6d0e-8f3c-4b1a-9e7d-2c5f8a1b3d4e',
    name: 'Ana From Sign-up',
    email: identity.email,
    passwordHash: 'stored-hash',
    firebaseUid: null,
    tokenVersion: 2,
    ...overrides,
  }) as User;

const uniqueViolation = () =>
  new QueryFailedError('INSERT', [], { code: '23505' } as unknown as Error);

describe('GoogleSignInService', () => {
  let verifier: { verify: jest.Mock };
  let authService: {
    createSignedInResponse: jest.Mock;
    matchesOwnPassword: jest.Mock;
  };
  let signInFailures: { countAttempt: jest.Mock; clear: jest.Mock };
  let manager: {
    findOneBy: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let transaction: jest.Mock;
  let service: GoogleSignInService;

  beforeEach(() => {
    verifier = { verify: jest.fn().mockResolvedValue(identity) };
    authService = {
      createSignedInResponse: jest
        .fn()
        .mockResolvedValue({ responseMessage: 'Login Success', data: {} }),
      matchesOwnPassword: jest.fn(
        async (user: User | null, password: string) =>
          Boolean(user?.passwordHash) && password === 'right-password',
      ),
    };
    signInFailures = {
      countAttempt: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    manager = {
      findOneBy: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      create: jest.fn((_entity, values) => values),
      save: jest.fn(async (entity, values) =>
        entity === User
          ? { ...values, id: 'new-user-id', tokenVersion: 0 }
          : values,
      ),
    };
    transaction = jest.fn(
      (run: (transactionManager: EntityManager) => Promise<unknown>) =>
        run(manager as unknown as EntityManager),
    );
    service = new GoogleSignInService(
      verifier as unknown as GoogleIdTokenVerifier,
      authService as unknown as AuthService,
      { transaction } as unknown as DataSource,
      signInFailures as unknown as SignInFailures,
    );
  });

  it('signs in the account already linked to the Google account', async () => {
    manager.findOneBy.mockResolvedValue(
      account({ firebaseUid: identity.uid, email: 'old@gmail.com' }),
    );

    await service.signIn({ id_token: 'id-token' });

    expect(verifier.verify).toHaveBeenCalledWith('id-token');
    expect(manager.findOneBy).toHaveBeenCalledWith(User, {
      firebaseUid: identity.uid,
    });
    expect(manager.findOne).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(authService.createSignedInResponse).toHaveBeenCalledWith(
      'Login Success',
      account().id,
      2,
    );
  });

  it('refuses to link an unlinked password account with the same email', async () => {
    manager.findOne.mockResolvedValue(account());

    const refusal = await service
      .signIn({ id_token: 'id-token' })
      .catch((error: unknown) => error);

    expect(manager.findOne).toHaveBeenCalledWith(User, {
      where: { email: identity.email },
      lock: { mode: 'pessimistic_write' },
    });
    expect(refusal).toBeInstanceOf(ConflictException);
    expect((refusal as ConflictException).getResponse()).toEqual({
      message: PASSWORD_ACCOUNT_EXISTS_MESSAGE,
      details: { code: PASSWORD_ACCOUNT_EXISTS },
    });
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(authService.createSignedInResponse).not.toHaveBeenCalled();
  });

  it('links an unlinked account without a password and keeps it unchanged', async () => {
    manager.findOne.mockResolvedValue(account({ passwordHash: null }));

    await service.signIn({ id_token: 'id-token' });

    expect(manager.update).toHaveBeenCalledWith(
      User,
      { id: account().id },
      { firebaseUid: identity.uid },
    );
    expect(manager.save).not.toHaveBeenCalled();
    expect(authService.createSignedInResponse).toHaveBeenCalledWith(
      'Login Success',
      account().id,
      2,
    );
  });

  it('signs in an account already linked to this Google account that also has a password', async () => {
    manager.findOneBy.mockResolvedValue(
      account({ firebaseUid: identity.uid, passwordHash: 'stored-hash' }),
    );

    await service.signIn({ id_token: 'id-token' });

    expect(manager.findOne).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
    expect(authService.createSignedInResponse).toHaveBeenCalledWith(
      'Login Success',
      account().id,
      2,
    );
  });

  it('uses an account a concurrent sign-in just linked to the same Google account', async () => {
    manager.findOne.mockResolvedValue(account({ firebaseUid: identity.uid }));

    await service.signIn({ id_token: 'id-token' });

    expect(manager.update).not.toHaveBeenCalled();
    expect(authService.createSignedInResponse).toHaveBeenCalled();
  });

  it('refuses an email whose account is linked to another Google account', async () => {
    manager.findOne.mockResolvedValue(account({ firebaseUid: 'other-uid' }));

    await expect(service.signIn({ id_token: 'id-token' })).rejects.toThrow(
      new ConflictException(EMAIL_LINKED_TO_OTHER_GOOGLE_ACCOUNT),
    );
    expect(manager.update).not.toHaveBeenCalled();
    expect(authService.createSignedInResponse).not.toHaveBeenCalled();
  });

  it('creates an account without a password and with an empty profile', async () => {
    await service.signIn({ id_token: 'id-token' });

    expect(manager.save).toHaveBeenNthCalledWith(1, User, {
      name: 'Ana Learner',
      email: identity.email,
      passwordHash: null,
      firebaseUid: identity.uid,
    });
    expect(manager.save).toHaveBeenNthCalledWith(2, Profile, {
      userId: 'new-user-id',
    });
    expect(authService.createSignedInResponse).toHaveBeenCalledWith(
      'Login Success',
      'new-user-id',
      0,
    );
  });

  it('retries once after a concurrent first sign-in created the account', async () => {
    const winner = account({ firebaseUid: identity.uid, passwordHash: null });
    manager.findOneBy.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    manager.save.mockRejectedValueOnce(uniqueViolation());

    await service.signIn({ id_token: 'id-token' });

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(authService.createSignedInResponse).toHaveBeenCalledWith(
      'Login Success',
      winner.id,
      winner.tokenVersion,
    );
  });

  it('does not retry other database errors', async () => {
    manager.save.mockRejectedValueOnce(new Error('connection lost'));

    await expect(service.signIn({ id_token: 'id-token' })).rejects.toThrow(
      'connection lost',
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('changes nothing for a rejected token', async () => {
    verifier.verify.mockRejectedValue(new ForbiddenException());

    await expect(
      service.signIn({ id_token: 'id-token' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  describe('link', () => {
    const link = (password = 'right-password') =>
      service.link({ id_token: 'id-token', password });
    const refusal = (password?: string) =>
      link(password).catch((error: unknown) => error);

    it('links the password account after its password and signs in like sign-in', async () => {
      manager.findOne.mockResolvedValue(account());

      await link();

      expect(verifier.verify).toHaveBeenCalledWith('id-token');
      expect(signInFailures.countAttempt).toHaveBeenCalledWith(identity.email);
      expect(manager.findOne).toHaveBeenCalledWith(User, {
        where: { email: identity.email },
        lock: { mode: 'pessimistic_write' },
      });
      expect(authService.matchesOwnPassword).toHaveBeenCalledWith(
        account(),
        'right-password',
      );
      expect(manager.update).toHaveBeenCalledWith(
        User,
        { id: account().id },
        { firebaseUid: identity.uid },
      );
      expect(manager.save).not.toHaveBeenCalled();
      expect(signInFailures.clear).toHaveBeenCalledWith(identity.email);
      expect(authService.createSignedInResponse).toHaveBeenCalledWith(
        'Login Success',
        account().id,
        2,
      );
    });

    it('refuses a wrong password with the sign-in 403 and links nothing', async () => {
      manager.findOne.mockResolvedValue(account());

      expect(await refusal('wrong-password')).toEqual(
        new ForbiddenException('invalid username or password'),
      );
      expect(signInFailures.countAttempt).toHaveBeenCalledWith(identity.email);
      expect(signInFailures.clear).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
      expect(authService.createSignedInResponse).not.toHaveBeenCalled();
    });

    it('refuses every attempt once the sign-in failure limit is reached, before any password check', async () => {
      signInFailures.countAttempt.mockRejectedValue(
        new ThrottlerException('Too many requests, please try again later'),
      );

      expect(await refusal()).toBeInstanceOf(ThrottlerException);
      expect(transaction).not.toHaveBeenCalled();
      expect(authService.matchesOwnPassword).not.toHaveBeenCalled();
    });

    it('refuses an account without a password with the same 403', async () => {
      manager.findOne.mockResolvedValue(account({ passwordHash: null }));

      expect(await refusal()).toEqual(
        new ForbiddenException('invalid username or password'),
      );
      expect(authService.matchesOwnPassword).toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('answers 404 when no active account has the email (deleted or never created), after the same password cost', async () => {
      expect(await refusal()).toBeInstanceOf(NotFoundException);
      expect(authService.matchesOwnPassword).toHaveBeenCalledWith(
        null,
        'right-password',
      );
      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('answers 409 GOOGLE_ALREADY_LINKED when a concurrent link of the same Google account won', async () => {
      manager.findOne.mockResolvedValue(account({ firebaseUid: identity.uid }));

      const error = await refusal();

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        details: { code: GOOGLE_ALREADY_LINKED },
      });
      expect(authService.matchesOwnPassword).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('answers 409 without a code when the account is linked to another Google account', async () => {
      manager.findOne.mockResolvedValue(account({ firebaseUid: 'other-uid' }));

      expect(await refusal()).toEqual(
        new ConflictException(EMAIL_LINKED_TO_OTHER_GOOGLE_ACCOUNT),
      );
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('answers 409 GOOGLE_ACCOUNT_LINKED_ELSEWHERE when the Google account is linked to another account', async () => {
      manager.findOne.mockResolvedValue(account());
      manager.findOneBy.mockResolvedValue(
        account({ id: 'other-account', firebaseUid: identity.uid }),
      );

      const error = await refusal();

      expect(manager.findOneBy).toHaveBeenCalledWith(User, {
        firebaseUid: identity.uid,
      });
      expect((error as ConflictException).getResponse()).toMatchObject({
        details: { code: GOOGLE_ACCOUNT_LINKED_ELSEWHERE },
      });
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('maps a unique violation from a concurrent link of the Google account elsewhere to 409', async () => {
      manager.findOne.mockResolvedValue(account());
      manager.update.mockRejectedValue(uniqueViolation());

      const error = await refusal();

      expect((error as ConflictException).getResponse()).toMatchObject({
        details: { code: GOOGLE_ACCOUNT_LINKED_ELSEWHERE },
      });
      expect(signInFailures.clear).not.toHaveBeenCalled();
      expect(authService.createSignedInResponse).not.toHaveBeenCalled();
    });

    it('checks the token first and counts nothing for a rejected token', async () => {
      verifier.verify.mockRejectedValue(new ForbiddenException());

      expect(await refusal()).toBeInstanceOf(ForbiddenException);
      expect(signInFailures.countAttempt).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });

    it('lets a later Google sign-in use the linked account directly', async () => {
      const linked = account({ firebaseUid: identity.uid });
      manager.findOneBy.mockResolvedValue(linked);

      await service.signIn({ id_token: 'id-token' });

      expect(manager.findOne).not.toHaveBeenCalled();
      expect(authService.createSignedInResponse).toHaveBeenCalledWith(
        'Login Success',
        linked.id,
        2,
      );
    });
  });
});

describe('googleAccountName', () => {
  it('uses the Google profile name as plain text', () => {
    expect(
      googleAccountName({ ...identity, name: '  <b>Ana</b>\u0007 Learner ' }),
    ).toBe('Ana Learner');
  });

  it('falls back to the email before @', () => {
    expect(googleAccountName({ ...identity, name: null })).toBe('ana.learner');
    expect(googleAccountName({ ...identity, name: '<i></i>' })).toBe(
      'ana.learner',
    );
  });

  it('keeps at most 120 characters without splitting a character', () => {
    const name = googleAccountName({
      ...identity,
      name: `${'a'.repeat(119)}😀😀`,
    });

    expect(Array.from(name)).toHaveLength(120);
    expect(name.endsWith('😀')).toBe(true);
  });
});
