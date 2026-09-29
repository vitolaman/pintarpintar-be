import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { IS_PUBLIC_ENDPOINT } from '~/common/decorator/public.decorator';
import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';

class TestJwtGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublicEndpoint = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ENDPOINT,
      [context.getHandler(), context.getClass()],
    );

    if (isPublicEndpoint) return true;
    throw new UnauthorizedException();
  }
}

describe('FaqController', () => {
  let app: INestApplication;
  const faqService = {
    findPublic: jest.fn(),
  };

  beforeEach(async () => {
    faqService.findPublic.mockResolvedValue({
      data: {
        categories: [
          {
            id: '20000000-0000-4000-8000-000000000001',
            name: 'Akun & Profil',
            display_order: 1,
            faqs: [
              {
                id: '30000000-0000-4000-8000-000000000001',
                question: 'Bagaimana cara mendaftar?',
                answer: 'Gunakan halaman pendaftaran.',
                display_order: 1,
              },
            ],
          },
        ],
        meta: { category_count: 1, question_count: 1 },
      },
      responseMessage: 'Get public FAQs success',
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [FaqController],
      providers: [FaqService, Reflector],
    })
      .overrideProvider(FaqService)
      .useValue(faqService)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new TestJwtGuard(app.get(Reflector)));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves the public grouped FAQ contract without a bearer token', async () => {
    const response = await request(app.getHttpServer())
      .get('/faqs/v1/get-public-faqs')
      .expect(200);

    expect(response.body).toEqual({
      data: {
        categories: [
          {
            id: '20000000-0000-4000-8000-000000000001',
            name: 'Akun & Profil',
            display_order: 1,
            faqs: [
              {
                id: '30000000-0000-4000-8000-000000000001',
                question: 'Bagaimana cara mendaftar?',
                answer: 'Gunakan halaman pendaftaran.',
                display_order: 1,
              },
            ],
          },
        ],
        meta: { category_count: 1, question_count: 1 },
      },
      responseMessage: 'Get public FAQs success',
    });
    expect(response.body).not.toHaveProperty('user_id');
    expect(faqService.findPublic).toHaveBeenCalledTimes(1);
  });
});
