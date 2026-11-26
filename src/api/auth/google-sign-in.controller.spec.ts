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
import { GoogleIdTokenVerifier } from './google-id-token.verifier';
import { GoogleSignInService } from './google-sign-in.service';
import { PasswordResetService } from './password-reset.service';

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
  const authService = { createSignedInResponse: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
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
        {
          provide: GoogleIdTokenVerifier,
          useValue: { verify: jest.fn().mockResolvedValue(identity) },
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
        'This email is registered with a password. Sign in with the password or reset it.',
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
});
