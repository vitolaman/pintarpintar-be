import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import request = require('supertest');
import { CustomHttpExceptionFilter } from '~/common/filters/exception-error.filter';
import {
  ClientAddressThrottlerGuard,
  SignInAccountThrottlerGuard,
} from '~/common/guard/client-address-throttler.guard';
import { User } from '../user/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  GOOGLE_SIGN_IN_FAILED,
  GoogleIdTokenVerifier,
} from './google-id-token.verifier';
import { ForbiddenException } from '@nestjs/common';
import { GoogleSignInService } from './google-sign-in.service';
import { PasswordResetService } from './password-reset.service';
import { ThrottlerException } from '@nestjs/throttler';
import { hashPassword } from '~/common/security/password';
import { TOO_MANY_REQUESTS_MESSAGE } from '~/common/guard/client-address-throttler.guard';
import {
  SIGN_IN_FAILURE_LIMIT,
  SignInFailures,
  signInEmailHash,
} from './sign-in-failures';

const identity = {
  uid: 'firebase-uid-1',
  email: 'ana.learner@gmail.com',
  name: 'Ana Learner',
};

const existing = (overrides: Partial<User>) =>
  ({
    id: '9a2b6d0e-8f3c-4b1a-9e7d-2c5f8a1b3d4e',
    email: identity.email,
    passwordHash: 'stored-hash',
    firebaseUid: null,
    tokenVersion: 0,
    ...overrides,
  }) as User;

// The real service and error filter behind the route; only the token check
// and the database are replaced.
describe('POST /api/v1/auth/google', () => {
  let app: INestApplication;
  const manager = {
    findOneBy: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const authService = {
    createSignedInResponse: jest.fn(),
    // The real check (bcrypt, unusable hash for no password).
    matchesOwnPassword: jest.fn((user: User | null, password: string) =>
      AuthService.prototype.matchesOwnPassword.call(null, user, password),
    ),
  };
  // SignInFailures without its SQL: the same count, limit and clear per email.
  const failures = new Map<string, number>();
  const signInFailures = {
    countAttempt: jest.fn(async (email: string) => {
      const count = (failures.get(signInEmailHash(email)) ?? 0) + 1;
      failures.set(signInEmailHash(email), count);
      if (count > SIGN_IN_FAILURE_LIMIT) {
        throw new ThrottlerException(TOO_MANY_REQUESTS_MESSAGE);
      }
    }),
    clear: jest.fn(async (email: string) => {
      failures.delete(signInEmailHash(email));
    }),
  };
  const verifier = { verify: jest.fn() };
  let passwordHash: string;
  beforeAll(async () => {
    passwordHash = await hashPassword('right-password');
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    failures.clear();
    verifier.verify.mockResolvedValue(identity);
    manager.findOneBy.mockResolvedValue(null);
    manager.findOne.mockResolvedValue(null);
    authService.createSignedInResponse.mockResolvedValue({
      responseMessage: 'Login Success',
      data: { token: 'session-token' },
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        GoogleSignInService,
        { provide: AuthService, useValue: authService },
        { provide: PasswordResetService, useValue: {} },
        { provide: SignInFailures, useValue: signInFailures },
        {
          provide: GoogleIdTokenVerifier,
          useValue: verifier,
        },
        {
          provide: DataSource,
          useValue: {
            transaction: (run: (m: EntityManager) => Promise<unknown>) =>
              run(manager as unknown as EntityManager),
          },
        },
      ],
    })
      .overrideGuard(ClientAddressThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SignInAccountThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new CustomHttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  it('answers 409 PASSWORD_ACCOUNT_EXISTS for an unlinked password account', async () => {
    manager.findOne.mockResolvedValue(existing({}));

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ id_token: 'id-token' })
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: 'CONFLICT',
      responseMessage:
        'This email is registered with a password. Confirm the password to link Google, sign in with the password, or reset it.',
      details: { code: 'PASSWORD_ACCOUNT_EXISTS' },
    });
    expect(manager.update).not.toHaveBeenCalled();
    expect(authService.createSignedInResponse).not.toHaveBeenCalled();
  });

  it('answers 409 without a code for an email linked to another Google account', async () => {
    manager.findOne.mockResolvedValue(existing({ firebaseUid: 'other-uid' }));

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ id_token: 'id-token' })
      .expect(409);

    expect(response.body.responseMessage).toBe(
      'This email is linked to another Google account',
    );
    expect(response.body.details).toBeUndefined();
  });

  it('signs in the account linked to this Google account, password or not', async () => {
    manager.findOneBy.mockResolvedValue(
      existing({ firebaseUid: identity.uid }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ id_token: 'id-token' })
      .expect(200);

    expect(response.body.data).toEqual({ token: 'session-token' });
    expect(manager.update).not.toHaveBeenCalled();
  });

  describe('POST /api/v1/auth/google/link', () => {
    const link = (password: string, status: number) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/google/link')
        .send({ id_token: 'id-token', password })
        .expect(status);

    it('links after the right password and answers like sign-in', async () => {
      manager.findOne.mockResolvedValue(existing({ passwordHash }));

      const response = await link('right-password', 200);

      expect(response.body).toEqual({
        responseMessage: 'Login Success',
        data: { token: 'session-token' },
      });
      expect(manager.update).toHaveBeenCalledWith(
        User,
        { id: existing({}).id },
        { firebaseUid: identity.uid },
      );
    });

    it('answers a wrong password with the sign-in 403 body', async () => {
      manager.findOne.mockResolvedValue(existing({ passwordHash }));

      const response = await link('wrong-password', 403);

      expect(response.body).toEqual({
        statusCode: 403,
        error: 'FORBIDDEN',
        responseMessage: 'invalid username or password',
      });
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('answers 429 after 10 failures, also for the right password, and links nothing', async () => {
      manager.findOne.mockResolvedValue(existing({ passwordHash }));
      for (let attempt = 0; attempt < SIGN_IN_FAILURE_LIMIT; attempt += 1) {
        await link('wrong-password', 403);
      }

      const response = await link('right-password', 429);

      expect(response.body).toEqual({
        statusCode: 429,
        error: 'TOO_MANY_REQUESTS',
        responseMessage: TOO_MANY_REQUESTS_MESSAGE,
      });
      expect(manager.update).not.toHaveBeenCalled();
      expect(authService.createSignedInResponse).not.toHaveBeenCalled();
    });

    it('answers 409 GOOGLE_ALREADY_LINKED for an account linked to this Google account', async () => {
      manager.findOne.mockResolvedValue(
        existing({ passwordHash, firebaseUid: identity.uid }),
      );

      const response = await link('right-password', 409);

      expect(response.body.details).toEqual({ code: 'GOOGLE_ALREADY_LINKED' });
    });

    it('answers 409 GOOGLE_ACCOUNT_LINKED_ELSEWHERE when the Google account belongs to another account', async () => {
      manager.findOne.mockResolvedValue(existing({ passwordHash }));
      manager.findOneBy.mockResolvedValue(
        existing({ id: 'other-account', firebaseUid: identity.uid }),
      );

      const response = await link('right-password', 409);

      expect(response.body).toEqual({
        statusCode: 409,
        error: 'CONFLICT',
        responseMessage: 'This Google account is linked to another account',
        details: { code: 'GOOGLE_ACCOUNT_LINKED_ELSEWHERE' },
      });
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('answers 404 when no active account has the email', async () => {
      const response = await link('right-password', 404);

      expect(response.body.responseMessage).toBe(
        'No account with this email to link',
      );
    });

    it('answers an expired or invalid token like POST /auth/google and counts nothing', async () => {
      verifier.verify.mockRejectedValue(
        new ForbiddenException({
          message: GOOGLE_SIGN_IN_FAILED,
          details: { code: 'GOOGLE_TOKEN_REJECTED' },
        }),
      );

      const response = await link('right-password', 403);

      expect(response.body).toEqual({
        statusCode: 403,
        error: 'FORBIDDEN',
        responseMessage: 'Google sign-in failed',
        details: { code: 'GOOGLE_TOKEN_REJECTED' },
      });
      expect(signInFailures.countAttempt).not.toHaveBeenCalled();
      expect(manager.findOne).not.toHaveBeenCalled();
    });

    it('rejects a body without a password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/google/link')
        .send({ id_token: 'id-token' })
        .expect(400);
      expect(signInFailures.countAttempt).not.toHaveBeenCalled();
    });
  });
});
