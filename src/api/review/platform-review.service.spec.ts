import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { Merchant } from '../merchant/entities/merchant.entity';
import { SavePlatformReviewDto } from './dto/platform-review.dto';
import { PlatformReview } from './entities/platform-review.entity';
import { PlatformReviewService } from './platform-review.service';

const USER = '10000000-0000-4000-8000-000000000001';
const MERCHANT = '20000000-0000-4000-8000-000000000001';

describe('SavePlatformReviewDto', () => {
  const errorFields = async (input: object) =>
    (await validate(plainToInstance(SavePlatformReviewDto, input))).map(
      (error) => error.property,
    );

  it.each([
    [{ rating: 5 }, []],
    [{ rating: '4', comment: ' Mantap ' }, []],
    [{ rating: 0 }, ['rating']],
    [{ rating: 6 }, ['rating']],
    [{ rating: 4.5 }, ['rating']],
    [{}, ['rating']],
    [{ rating: 5, comment: 'x'.repeat(2001) }, ['comment']],
  ])('validates %j', async (input, fields) => {
    expect(await errorFields(input)).toEqual(fields);
  });

  it('trims the comment and treats blank as none', () => {
    expect(
      plainToInstance(SavePlatformReviewDto, { rating: 5, comment: ' Oke ' })
        .comment,
    ).toBe('Oke');
    expect(
      plainToInstance(SavePlatformReviewDto, { rating: 5, comment: '  ' })
        .comment,
    ).toBeNull();
  });
});

describe('PlatformReviewService', () => {
  let merchant: Partial<Merchant> | null;
  let existing: Partial<PlatformReview> | null;
  let saved: Partial<PlatformReview>[];
  let service: PlatformReviewService;

  beforeEach(() => {
    merchant = { id: MERCHANT, userId: USER, status: 'active' };
    existing = null;
    saved = [];
    const manager = {
      findOne: jest.fn(async () => merchant),
      findOneBy: jest.fn(async () => existing && { ...existing }),
      query: jest.fn(async () => []),
      create: jest.fn((_entity, value) => ({ ...value })),
      save: jest.fn(async (_entity, value) => {
        saved.push(value);
        return {
          ...value,
          created_at: new Date(0),
          updated_at: new Date(1),
        };
      }),
    };
    const dataSource = {
      manager,
      transaction: jest.fn((callback) => callback(manager)),
    };
    service = new PlatformReviewService(dataSource as unknown as DataSource);
  });

  it('creates the first review of the store', async () => {
    const response = await service.save(USER, { rating: 5, comment: 'Oke' });
    expect(response.created).toBe(true);
    expect(saved).toEqual([
      expect.objectContaining({
        merchantId: MERCHANT,
        userId: USER,
        rating: 5,
        comment: 'Oke',
      }),
    ]);
    expect(response.data).toMatchObject({ rating: 5, comment: 'Oke' });
  });

  it('replaces the existing review instead of adding one', async () => {
    existing = {
      id: 'review-1',
      merchantId: MERCHANT,
      rating: 5,
      comment: 'Oke',
    };
    const response = await service.save(USER, { rating: 4 });
    expect(response.created).toBe(false);
    expect(saved).toEqual([
      expect.objectContaining({ id: 'review-1', rating: 4, comment: null }),
    ]);
  });

  it('needs a store', async () => {
    merchant = null;
    await expect(service.save(USER, { rating: 5 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(saved).toEqual([]);
  });

  it('needs an active store to save', async () => {
    merchant = { ...merchant, status: 'inactive' };
    await expect(service.save(USER, { rating: 5 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(saved).toEqual([]);
  });

  it('reads null before the store reviews', async () => {
    await expect(service.findOwn(USER)).resolves.toMatchObject({ data: null });
  });
});
