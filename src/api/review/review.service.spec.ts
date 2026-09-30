import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  const input = { class_id: classId, rating: 5, comment: 'Materinya jelas.' };
  let manager: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock; query: jest.Mock };
  let service: ReviewService;

  beforeEach(() => {
    manager = {
      query: jest
        .fn()
        .mockResolvedValue([{ id: classId, enrolled: true, reviewed: false }]),
      create: jest.fn((_target, value) => value),
      save: jest.fn(async (_target, value) => ({ ...value, id: 'review-id' })),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
      query: jest.fn().mockResolvedValue([
        {
          id: 'review-id',
          rating: 5,
          comment: 'Materinya jelas.',
          created_at: new Date('2026-09-30T00:00:00.000Z'),
          reviewer_name: 'John Doe',
          reviewer_avatar_object_key: null,
        },
      ]),
    };
    service = new ReviewService(dataSource as unknown as DataSource);
  });

  it('creates a class review for an enrolled learner', async () => {
    const response = await service.create(userId, input);

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId,
        classId,
        productId: null,
        orderId: null,
        rating: 5,
      }),
    );
    expect(response.data).toMatchObject({
      id: 'review-id',
      rating: 5,
      reviewer_name: 'John Doe',
    });
  });

  it.each([
    [[], NotFoundException],
    [[{ id: classId, enrolled: false, reviewed: false }], ForbiddenException],
    [[{ id: classId, enrolled: true, reviewed: true }], ConflictException],
  ])('rejects the target state %j', async (target, expected) => {
    manager.query.mockResolvedValue(target);

    await expect(service.create(userId, input)).rejects.toBeInstanceOf(
      expected,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('maps a concurrent duplicate on the unique index to 409', async () => {
    const duplicate = new QueryFailedError(
      'INSERT',
      [],
      new Error('duplicate'),
    );
    Object.assign(duplicate, { code: '23505' });
    manager.save.mockRejectedValue(duplicate);

    await expect(service.create(userId, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('returns the class rating summary with paged reviews', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ found: true, average: '4.5', total: 12 }])
      .mockResolvedValueOnce([]);

    const response = await service.findClassReviews(classId, {
      page: 2,
      limit: 5,
    } as never);

    expect(response.data).toEqual({
      average_rating: 4.5,
      review_count: 12,
      reviews: [],
    });
    expect(response.meta).toEqual({
      page: 2,
      limit: 5,
      total: 12,
      totalPage: 3,
    });
    expect(dataSource.query.mock.calls[1][1]).toEqual([classId, 5, 5]);
  });

  it('returns 404 when listing reviews of an unknown class', async () => {
    dataSource.query.mockResolvedValueOnce([
      { found: false, average: '0', total: 0 },
    ]);

    await expect(
      service.findClassReviews(classId, { page: 1, limit: 10 } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
