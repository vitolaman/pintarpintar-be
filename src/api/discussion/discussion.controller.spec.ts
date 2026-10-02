import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';

const userId = '10000000-0000-4000-8000-000000000001';
const classId = '30000000-0000-4000-8000-000000000001';

class SignedInGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = { id: userId };
    return true;
  }
}

describe('DiscussionController threads', () => {
  let app: INestApplication;
  const discussionService = { findThreads: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [DiscussionController],
      providers: [{ provide: DiscussionService, useValue: discussionService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(new SignedInGuard());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('reads the class from the class_id query parameter', async () => {
    discussionService.findThreads.mockResolvedValue({ data: [] });

    await request(app.getHttpServer())
      .get('/api/v1/discussions/threads')
      .query({ class_id: classId, page: 2 })
      .expect(200);

    expect(discussionService.findThreads).toHaveBeenCalledWith(
      userId,
      classId,
      expect.objectContaining({ class_id: classId, page: 2, limit: 10 }),
    );
  });

  it.each([
    ['missing', {}],
    ['not a UUID', { class_id: 'kelas-1' }],
  ])('rejects a %s class_id with 400', async (_label, query) => {
    await request(app.getHttpServer())
      .get('/api/v1/discussions/threads')
      .query(query)
      .expect(400);

    expect(discussionService.findThreads).not.toHaveBeenCalled();
  });
});
