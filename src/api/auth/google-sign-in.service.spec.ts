import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import { AuthService } from './auth.service';
import { GoogleIdTokenVerifier } from './google-id-token.verifier';
import {
  EMAIL_LINKED_TO_OTHER_GOOGLE_ACCOUNT,
  googleAccountName,
  GoogleSignInService,
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
  let authService: { createSignedInResponse: jest.Mock };
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

  it('links the password account with the same email and keeps it unchanged', async () => {
    manager.findOne.mockResolvedValue(account());

    await service.signIn({ id_token: 'id-token' });

    expect(manager.findOne).toHaveBeenCalledWith(User, {
      where: { email: identity.email },
      lock: { mode: 'pessimistic_write' },
    });
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
