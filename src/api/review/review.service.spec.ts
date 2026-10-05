import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, QueryFailedError } from 'typeorm';
import { CreateReviewDto, CreateReviewReplyDto } from './dto/review.dto';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const classId = '30000000-0000-4000-8000-000000000001';
  const input = { class_id: classId, rating: 5, comment: 'Materinya jelas.' };
  let manager: Record<string, jest.Mock>;
  let dataSource: {
    transaction: jest.Mock;
    query: jest.Mock;
    createQueryBuilder: jest.Mock;
    manager: Record<string, jest.Mock>;
  };
  let insert: Record<string, jest.Mock>;
  let service: ReviewService;

  beforeEach(() => {
    manager = {
      query: jest
        .fn()
        .mockResolvedValue([{ id: classId, enrolled: true, reviewed: false }]),
      create: jest.fn((_target, value) => value),
      save: jest.fn(async (_target, value) => ({ ...value, id: 'review-id' })),
    };
    insert = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
      createQueryBuilder: jest.fn(() => insert),
      manager: {
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        create: jest.fn((_target, value) => value),
        save: jest.fn(async (_target, value) => ({ ...value, id: 'reply-1' })),
      },
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
      viewer_can_reply: false,
      reviews: [],
    });
    expect(response.meta).toEqual({
      page: 2,
      limit: 5,
      total: 12,
      total_page: 3,
    });
    expect(dataSource.query.mock.calls[0][1]).toEqual([classId, null]);
    expect(dataSource.query.mock.calls[1][1]).toEqual([classId, 5, 5, null]);
    // An empty page needs no reply query.
    expect(dataSource.query).toHaveBeenCalledTimes(2);
  });

  describe('marks and replies in the lists', () => {
    const viewerId = '10000000-0000-4000-8000-000000000009';
    const reviewRow = (id: string, extra: object) => ({
      id,
      rating: 5,
      comment: 'Mantap',
      created_at: new Date('2026-09-30T00:00:00.000Z'),
      reviewer_name: 'John Doe',
      reviewer_avatar_object_key: null,
      ...extra,
    });

    it('adds marks, the caller flags and replies oldest first', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          { found: true, average: '5', total: 2, viewer_can_reply: true },
        ])
        .mockResolvedValueOnce([
          reviewRow('review-1', {
            helpful_count: '2',
            viewer_has_voted: true,
            is_own_review: false,
          }),
          reviewRow('review-2', {
            helpful_count: 0,
            viewer_has_voted: false,
            is_own_review: true,
          }),
        ])
        .mockResolvedValueOnce([
          {
            id: 'reply-1',
            review_id: 'review-1',
            comment: 'Terima kasih!',
            created_at: new Date('2026-10-01T00:00:00.000Z'),
            author_role: 'merchant',
            author_name: 'Toko Ayu',
            author_avatar_object_key: null,
          },
          {
            id: 'reply-2',
            review_id: 'review-1',
            comment: 'Setuju.',
            created_at: new Date('2026-10-02T00:00:00.000Z'),
            author_role: 'buyer',
            author_name: 'Budi',
            author_avatar_object_key: null,
          },
        ]);

      const response = await service.findClassReviews(
        classId,
        { page: 1, limit: 10 } as never,
        viewerId,
      );

      expect(response.data.viewer_can_reply).toBe(true);
      expect(dataSource.query.mock.calls[0][1]).toEqual([classId, viewerId]);
      expect(dataSource.query.mock.calls[1][1]).toEqual([
        classId,
        10,
        0,
        viewerId,
      ]);
      expect(dataSource.query.mock.calls[2][1]).toEqual([
        ['review-1', 'review-2'],
      ]);
      expect(dataSource.query.mock.calls[2][0]).toContain(
        'ORDER BY reply.created_at, reply.id',
      );
      const [first, second] = response.data.reviews;
      expect(first).toMatchObject({
        id: 'review-1',
        helpful_count: 2,
        viewer_has_voted: true,
        is_own_review: false,
      });
      expect(
        first.replies.map((reply) => [reply.id, reply.author_role]),
      ).toEqual([
        ['reply-1', 'merchant'],
        ['reply-2', 'buyer'],
      ]);
      expect(first.replies[0]).toEqual({
        id: 'reply-1',
        comment: 'Terima kasih!',
        created_at: new Date('2026-10-01T00:00:00.000Z'),
        author_name: 'Toko Ayu',
        author_avatar_url: null,
        author_role: 'merchant',
      });
      expect(second).toMatchObject({ is_own_review: true, replies: [] });
    });

    it('lists product reviews with the same fields', async () => {
      const productId = '40000000-0000-4000-8000-000000000001';
      dataSource.query
        .mockResolvedValueOnce([
          { found: true, average: '4', total: 1, viewer_can_reply: false },
        ])
        .mockResolvedValueOnce([
          reviewRow('review-3', {
            helpful_count: 1,
            viewer_has_voted: false,
            is_own_review: false,
          }),
        ])
        .mockResolvedValueOnce([]);

      const response = await service.findProductReviews(productId, {
        page: 1,
        limit: 10,
      } as never);

      expect(dataSource.query.mock.calls[0][1]).toEqual([productId, null]);
      expect(dataSource.query.mock.calls[1][0]).toContain(
        'review.product_id = $1',
      );
      expect(response.data.viewer_can_reply).toBe(false);
      expect(response.data.reviews[0]).toMatchObject({
        helpful_count: 1,
        replies: [],
      });
    });
  });

  describe('helpful marks', () => {
    const reviewId = '50000000-0000-4000-8000-000000000001';
    const authorId = '10000000-0000-4000-8000-000000000002';

    it('stores a mark idempotently and returns the count', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ id: reviewId, user_id: authorId }])
        .mockResolvedValueOnce([{ helpful_count: 1, viewer_has_voted: true }]);

      const response = await service.markHelpful(userId, reviewId);

      expect(insert.values).toHaveBeenCalledWith({ reviewId, userId });
      expect(insert.orIgnore).toHaveBeenCalled();
      expect(response.data).toEqual({
        helpful_count: 1,
        viewer_has_voted: true,
      });
    });

    it('refuses a mark on your own review', async () => {
      dataSource.query.mockResolvedValueOnce([
        { id: reviewId, user_id: userId },
      ]);

      await expect(service.markHelpful(userId, reviewId)).rejects.toThrow(
        new ForbiddenException('You cannot mark your own review as helpful'),
      );
      expect(insert.execute).not.toHaveBeenCalled();
    });

    it('returns 404 for a review that is not shown', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(service.markHelpful(userId, reviewId)).rejects.toThrow(
        new NotFoundException('Review not found'),
      );
      expect(dataSource.query.mock.calls[0][0]).toContain(
        "product.publication_status = 'published'",
      );
      expect(dataSource.query.mock.calls[0][0]).toContain(
        'class.deleted_at IS NULL',
      );
    });

    it("removes only the caller's mark", async () => {
      dataSource.query
        .mockResolvedValueOnce([{ id: reviewId, user_id: authorId }])
        .mockResolvedValueOnce([{ helpful_count: 0, viewer_has_voted: false }]);

      const response = await service.unmarkHelpful(userId, reviewId);

      expect(dataSource.manager.delete).toHaveBeenCalledWith(
        expect.anything(),
        { reviewId, userId },
      );
      expect(response.data).toEqual({
        helpful_count: 0,
        viewer_has_voted: false,
      });
    });
  });

  describe('replies', () => {
    const reviewId = '50000000-0000-4000-8000-000000000001';

    it.each([['merchant'], ['mentor'], ['buyer']])(
      'stores a reply by a %s with that role',
      async (relation) => {
        dataSource.query
          .mockResolvedValueOnce([{ id: reviewId, relation }])
          .mockResolvedValueOnce([
            {
              id: 'reply-1',
              review_id: reviewId,
              comment: 'Terima kasih!',
              created_at: new Date('2026-10-01T00:00:00.000Z'),
              author_role: relation,
              author_name: 'John Doe',
              author_avatar_object_key: null,
            },
          ]);

        const response = await service.reply(userId, reviewId, {
          comment: 'Terima kasih!',
        });

        expect(dataSource.manager.save).toHaveBeenCalledWith(
          expect.anything(),
          {
            reviewId,
            authorId: userId,
            authorRole: relation,
            comment: 'Terima kasih!',
          },
        );
        expect(response.data.author_role).toBe(relation);
        expect(dataSource.query.mock.calls[1][1]).toEqual(['reply-1']);
      },
    );

    it('refuses a user unrelated to the item', async () => {
      dataSource.query.mockResolvedValueOnce([
        { id: reviewId, relation: null },
      ]);

      await expect(
        service.reply(userId, reviewId, { comment: 'Halo' }),
      ).rejects.toThrow(
        new ForbiddenException(
          'Only buyers, the merchant and the class mentors can reply',
        ),
      );
      expect(dataSource.manager.save).not.toHaveBeenCalled();
    });

    it('returns 404 for a review that is not shown', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(
        service.reply(userId, reviewId, { comment: 'Halo' }),
      ).rejects.toThrow(new NotFoundException('Review not found'));
    });

    it('checks the merchant, then mentors, then learners and buyers', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await service.reply(userId, reviewId, { comment: 'Halo' }).catch(() => {
        // Only the query text is checked here.
      });

      const sql: string = dataSource.query.mock.calls[0][0];
      const merchant = sql.indexOf("THEN 'merchant'");
      const mentor = sql.indexOf("THEN 'mentor'");
      const buyer = sql.indexOf("THEN 'buyer'");
      expect(merchant).toBeGreaterThan(-1);
      expect(mentor).toBeGreaterThan(merchant);
      expect(buyer).toBeGreaterThan(mentor);
      expect(sql).toContain("mentor.status = 'active'");
      expect(sql).toContain(
        'access.expires_at IS NULL OR access.expires_at > now()',
      );
    });
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
    expect(response.data.reviews[0]).not.toHaveProperty(
      'reviewer_avatar_object_key',
    );
    expect(dataSource.query.mock.calls[1][0]).toContain(
      "ELSE (CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END) END AS item_type",
    );
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
      total_page: 1,
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

describe('CreateReviewReplyDto', () => {
  it('trims the comment', async () => {
    const dto = plainToInstance(CreateReviewReplyDto, {
      comment: '  Terima kasih!  ',
    });
    expect(dto.comment).toBe('Terima kasih!');
    expect(await validate(dto)).toEqual([]);
  });

  it.each([
    ['an empty', ''],
    ['a blank', '   '],
    ['a null', null],
    ['a 2,001-character', 'x'.repeat(2001)],
  ])('rejects %s comment', async (_label, comment) => {
    const errors = await validate(
      plainToInstance(CreateReviewReplyDto, { comment }),
    );
    expect(errors.map((error) => error.property)).toEqual(['comment']);
  });
});
