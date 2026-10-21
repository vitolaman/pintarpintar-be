import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Auth, DecodedIdToken } from 'firebase-admin/auth';
import {
  firebaseAuthProvider,
  GOOGLE_SIGN_IN_FAILED,
  GOOGLE_SIGN_IN_UNAVAILABLE,
  GoogleIdTokenVerifier,
} from './google-id-token.verifier';

const googleToken = (overrides: Partial<DecodedIdToken> = {}) =>
  ({
    uid: 'firebase-uid-1',
    sub: 'firebase-uid-1',
    aud: 'pintarpintar-107a8',
    iss: 'https://securetoken.google.com/pintarpintar-107a8',
    email: ' Ana.Learner@Gmail.com ',
    email_verified: true,
    name: 'Ana Learner',
    firebase: { sign_in_provider: 'google.com', identities: {} },
    ...overrides,
  }) as DecodedIdToken;

describe('GoogleIdTokenVerifier', () => {
  let verifyIdToken: jest.Mock;
  let verifier: GoogleIdTokenVerifier;

  beforeEach(() => {
    verifyIdToken = jest.fn();
    verifier = new GoogleIdTokenVerifier({ verifyIdToken } as unknown as Auth);
  });

  it('returns the Google identity with the email lowercased', async () => {
    verifyIdToken.mockResolvedValue(googleToken());

    await expect(verifier.verify('id-token')).resolves.toEqual({
      uid: 'firebase-uid-1',
      email: 'ana.learner@gmail.com',
      name: 'Ana Learner',
    });
    expect(verifyIdToken).toHaveBeenCalledWith('id-token');
  });

  it('keeps a missing profile name as null', async () => {
    verifyIdToken.mockResolvedValue(googleToken({ name: undefined }));

    await expect(verifier.verify('id-token')).resolves.toMatchObject({
      name: null,
    });
  });

  it.each([
    ['an expired token', { code: 'auth/id-token-expired' }],
    [
      'a token of another project or a forged one',
      { code: 'auth/argument-error' },
    ],
    ['an unexpected failure', new Error('network down')],
  ])('rejects %s with the single 403', async (_label, failure) => {
    verifyIdToken.mockRejectedValue(failure);

    await expect(verifier.verify('id-token')).rejects.toThrow(
      new ForbiddenException(GOOGLE_SIGN_IN_FAILED),
    );
  });

  it.each([
    [
      'another provider',
      googleToken({
        firebase: { sign_in_provider: 'password', identities: {} },
      }),
    ],
    ['a missing email', googleToken({ email: undefined })],
    ['a blank email', googleToken({ email: '  ' })],
    ['an unverified email', googleToken({ email_verified: false })],
    ['no verified flag', googleToken({ email_verified: undefined })],
  ])('rejects %s with the single 403', async (_label, token) => {
    verifyIdToken.mockResolvedValue(token);

    await expect(verifier.verify('id-token')).rejects.toThrow(
      new ForbiddenException(GOOGLE_SIGN_IN_FAILED),
    );
  });

  it('answers 503 when Google sign-in is not configured', async () => {
    await expect(
      new GoogleIdTokenVerifier(null).verify('id-token'),
    ).rejects.toThrow(
      new ServiceUnavailableException(GOOGLE_SIGN_IN_UNAVAILABLE),
    );
  });
});

describe('firebaseAuthProvider', () => {
  const settings = (values: Record<string, string | undefined>) =>
    ({ get: (name: string) => values[name] }) as unknown as ConfigService;

  afterEach(() => {
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  });

  it('is off without a project id', () => {
    expect(firebaseAuthProvider.useFactory(settings({}))).toBeNull();
    expect(
      firebaseAuthProvider.useFactory(settings({ FIREBASE_PROJECT_ID: ' ' })),
    ).toBeNull();
  });

  it('is off while the emulator variable would accept unsigned tokens', () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

    expect(
      firebaseAuthProvider.useFactory(
        settings({ FIREBASE_PROJECT_ID: 'pintarpintar-107a8' }),
      ),
    ).toBeNull();
  });

  it('verifies with the project id alone and reuses the app', async () => {
    const config = settings({ FIREBASE_PROJECT_ID: 'pintarpintar-107a8' });
    const auth = firebaseAuthProvider.useFactory(config);

    expect(auth).not.toBeNull();
    expect(auth?.app.options.projectId).toBe('pintarpintar-107a8');
    expect(firebaseAuthProvider.useFactory(config)?.app).toBe(auth?.app);
    // A malformed token fails locally, before any key download.
    await expect(auth?.verifyIdToken('not-a-token')).rejects.toMatchObject({
      code: 'auth/argument-error',
    });
  });
});
