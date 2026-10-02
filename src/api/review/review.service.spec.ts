import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, QueryFailedError } from 'typeorm';
import { CreateReviewDto } from './dto/review.dto';
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

  describe('product reviews', () => {
    const productId = '40000000-0000-4000-8000-000000000001';
    const productInput = { product_id: productId, rating: 4 };

    it('creates a product review for a buyer', async () => {
      manager.query.mockResolvedValue([
        { id: productId, owned: true, reviewed: false },
      ]);

      await service.create(userId, productInput);

      expect(manager.query.mock.calls[0][0]).toContain(
        'access.expires_at IS NULL OR access.expires_at > now()',
      );
      expect(manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ productId, classId: null, rating: 4 }),
      );
    });

    it.each([
      ['a non-buyer', { owned: false, reviewed: false }, ForbiddenException],
      ['a second review', { owned: true, reviewed: true }, ConflictException],
    ])('rejects %s', async (_label, flags, error) => {
      manager.query.mockResolvedValue([{ id: productId, ...flags }]);

      await expect(service.create(userId, productInput)).rejects.toBeInstanceOf(
        error,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('rejects a review naming both a class and a product', async () => {
      await expect(
        service.create(userId, { ...productInput, class_id: classId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lists reviews of a published product only', async () => {
      dataSource.query.mockResolvedValueOnce([
        { found: false, average: 0, total: 0 },
      ]);

      await expect(
        service.findProductReviews(productId, { page: 1, limit: 10 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(dataSource.query.mock.calls[0][0]).toContain(
        "publication_status = 'published'",
      );
    });
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

  it("lists a merchant's class and product reviews with the item", async () => {
    const merchantId = '20000000-0000-4000-8000-000000000001';
    dataSource.query
      .mockResolvedValueOnce([{ found: true, average: '4.5', total: 2 }])
      .mockResolvedValueOnce([
        {
          id: 'review-1',
          rating: 5,
          comment: 'Mantap',
          created_at: new Date('2026-09-30T00:00:00.000Z'),
          reviewer_name: 'John Doe',
          reviewer_avatar_object_key: null,
          item_id: classId,
          item_type: 'bootcamp',
          item_title: 'PLC Programming Bootcamp',
        },
      ]);

    const response = await service.findMerchantReviews(merchantId, {
      page: 1,
      limit: 10,
    } as never);

    expect(response.data.average_rating).toBe(4.5);
    expect(response.data.reviews[0]).toMatchObject({
      reviewer_name: 'John Doe',
      reviewer_avatar_url: null,
      item: {
        id: classId,
        type: 'bootcamp',
        title: 'PLC Programming Bootcamp',
      },
    });
    expect(response.meta).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPage: 1,
    });
  });

  it('returns 404 for reviews of an unknown merchant', async () => {
    dataSource.query.mockResolvedValueOnce([
      { found: false, average: '0', total: 0 },
    ]);

    await expect(
      service.findMerchantReviews('20000000-0000-4000-8000-000000000009', {
        page: 1,
        limit: 10,
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CreateReviewDto', () => {
  const classId = '30000000-0000-4000-8000-000000000001';

  it.each([[''], ['   '], [null]])(
    'clears the comment with %j',
    async (comment) => {
      const dto = plainToInstance(CreateReviewDto, {
        class_id: classId,
        rating: 5,
        comment,
      });
      expect(dto.comment).toBeNull();
      expect(await validate(dto)).toEqual([]);
    },
  );

  it('accepts a numeric string rating', async () => {
    const dto = plainToInstance(CreateReviewDto, {
      class_id: classId,
      rating: ' 4 ',
    });
    expect(dto.rating).toBe(4);
    expect(await validate(dto)).toEqual([]);
  });

  it.each([[''], ['6'], ['4.5'], [null]])(
    'rejects a rating of %j',
    async (rating) => {
      const errors = await validate(
        plainToInstance(CreateReviewDto, { class_id: classId, rating }),
      );
      expect(errors.map((error) => error.property)).toEqual(['rating']);
    },
  );
});
