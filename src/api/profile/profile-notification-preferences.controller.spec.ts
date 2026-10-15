import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request = require('supertest');
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { NotificationPreferencesService } from '../notification-preferences/notification-preferences.service';
import { EMAIL_PREFERENCE_FIELDS } from '../notification-preferences/preference-fields';

const userId = '10000000-0000-4000-8000-000000000001';
class TestAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.headers.authorization !== 'test-account')
      throw new UnauthorizedException();
    req.user = { id: userId };
    return true;
  }
}

describe('Profile notification preferences API', () => {
  let app: INestApplication;
  const preferences = {
    findEmailPreferences: jest.fn(),
    updateEmailPreferences: jest.fn(),
  };
  const data = Object.fromEntries(
    Object.keys(EMAIL_PREFERENCE_FIELDS).map((key) => [key, true]),
  );

  beforeEach(async () => {
    jest.clearAllMocks();
    preferences.findEmailPreferences.mockResolvedValue({ data });
    preferences.updateEmailPreferences.mockResolvedValue({ data });
    const moduleRef = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        { provide: ProfileService, useValue: {} },
        { provide: NotificationPreferencesService, useValue: preferences },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new TestAccountGuard());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  it('uses the authenticated account without requiring mentor/merchant roles', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/profile/notification-preferences')
      .set('Authorization', 'test-account')
      .expect(200);
    expect(response.body.data).toEqual(data);
    expect(preferences.findEmailPreferences).toHaveBeenCalledWith(userId);
  });

  it.each(['get', 'patch'] as const)(
    'requires authentication for %s',
    async (method) => {
      await request(app.getHttpServer())
        [method]('/api/v1/profile/notification-preferences')
        .expect(401);
      expect(preferences.findEmailPreferences).not.toHaveBeenCalled();
      expect(preferences.updateEmailPreferences).not.toHaveBeenCalled();
    },
  );

  it.each(Object.keys(EMAIL_PREFERENCE_FIELDS))(
    'accepts an independent false %s',
    async (key) => {
      await request(app.getHttpServer())
        .patch('/api/v1/profile/notification-preferences')
        .set('Authorization', 'test-account')
        .send({ [key]: false })
        .expect(200);
      expect(preferences.updateEmailPreferences).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ [key]: false }),
      );
    },
  );

  it.each(
    Object.keys(EMAIL_PREFERENCE_FIELDS).flatMap((key) =>
      [null, 'false', 0].map((value) => [key, value]),
    ),
  )('rejects %s = %s', async (key, value) => {
    await request(app.getHttpServer())
      .patch('/api/v1/profile/notification-preferences')
      .set('Authorization', 'test-account')
      .send({ [key]: value })
      .expect(400);
    expect(preferences.updateEmailPreferences).not.toHaveBeenCalled();
  });

  it.each(['user_id', 'email_weekly_report', 'unknown'])(
    'rejects undeclared %s',
    async (key) => {
      await request(app.getHttpServer())
        .patch('/api/v1/profile/notification-preferences')
        .set('Authorization', 'test-account')
        .send({ [key]: true })
        .expect(400);
      expect(preferences.updateEmailPreferences).not.toHaveBeenCalled();
    },
  );

  it('documents twelve required response keys and optional boolean patch keys', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const response = document.components.schemas
      .EmailPreferencesResponseDto as {
      required: string[];
      properties: object;
    };
    const update = document.components.schemas.UpdateEmailPreferencesDto as {
      required?: string[];
      properties: Record<string, { type: string }>;
    };
    expect(response.required.sort()).toEqual(
      Object.keys(EMAIL_PREFERENCE_FIELDS).sort(),
    );
    expect(Object.keys(update.properties).sort()).toEqual(
      Object.keys(EMAIL_PREFERENCE_FIELDS).sort(),
    );
    expect(update.required ?? []).toEqual([]);
    expect(
      Object.values(update.properties).every(
        (field) => field.type === 'boolean',
      ),
    ).toBe(true);
  });
});
