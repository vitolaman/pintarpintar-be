import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WishlistItem } from './entities/wishlist-item.entity';
import { WishlistService } from './wishlist.service';

const CLASS_ID = '10000000-0000-4000-8000-000000000001';

const catalogRow = (override: Record<string, unknown> = {}) => ({
  type: 'kelas',
  id: CLASS_ID,
  title: 'Belajar AutoCAD dari Nol',
  image: null,
  price: '299000',
  original_price: '350000',
  merchant_id: 'merchant-id',
  merchant_name: 'Akademi Teknik',
  merchant_slug: 'akademi-teknik',
  is_available: true,
  merchant_active: true,
  ...override,
});

describe('WishlistService', () => {
  let manager: Record<string, jest.Mock>;
  let service: WishlistService;

  beforeEach(() => {
    manager = {
      query: jest.fn(async (sql: string) =>
        sql.includes('advisory') ? [] : [catalogRow()],
      ),
      findOneBy: jest.fn(async () => null),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (_entity, value) => ({
        id: 'entry-id',
        addedAt: new Date('2026-09-30T00:00:00Z'),
        ...value,
      })),
      findAndCount: jest.fn(async () => [
        [
          {
            id: 'entry-id',
            classId: CLASS_ID,
            productId: null,
            bundleId: null,
          },
        ],
        11,
      ]),
      delete: jest.fn(async () => ({ affected: 1 })),
    };
    service = new WishlistService({
      manager,
      transaction: (work: (m: typeof manager) => unknown) => work(manager),
    } as unknown as DataSource);
  });

  it('adds an available item and reports it as new', async () => {
    const response = await service.add('user-id', {
      type: 'kelas',
      id: CLASS_ID,
    });

    expect(manager.save).toHaveBeenCalledWith(
      WishlistItem,
      expect.objectContaining({ userId: 'user-id', classId: CLASS_ID }),
    );
    expect(response.responseMessage).toBe('Add to wishlist success');
    expect(response.data.item).toMatchObject({ id: CLASS_ID, price: 299000 });
  });

  it('returns the existing entry without saving twice', async () => {
    manager.findOneBy.mockResolvedValueOnce({
      id: 'entry-id',
      classId: CLASS_ID,
      productId: null,
      bundleId: null,
    });

    const response = await service.add('user-id', {
      type: 'kelas',
      id: CLASS_ID,
    });

    expect(manager.save).not.toHaveBeenCalled();
    expect(response.responseMessage).toBe('Item already in wishlist');
  });

  it.each([
    ['unavailable', { is_available: false }],
    ['of an inactive merchant', { merchant_active: false }],
    ['of another type', { type: 'bootcamp' }],
  ])('rejects an item that is %s', async (_case, override) => {
    manager.query.mockImplementation(async (sql: string) =>
      sql.includes('advisory') ? [] : [catalogRow(override)],
    );
    await expect(
      service.add('user-id', { type: 'kelas', id: CLASS_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pages the list', async () => {
    const response = await service.findAll('user-id', { page: 2, limit: 10 });

    expect(manager.findAndCount).toHaveBeenCalledWith(
      WishlistItem,
      expect.objectContaining({
        where: { userId: 'user-id' },
        skip: 10,
        take: 10,
      }),
    );
    expect(response.meta).toEqual({
      page: 2,
      limit: 10,
      total: 11,
      totalPage: 2,
    });
  });

  it("removes only the caller's entry", async () => {
    await service.remove('user-id', 'entry-id');
    expect(manager.delete).toHaveBeenCalledWith(WishlistItem, {
      id: 'entry-id',
      userId: 'user-id',
    });

    manager.delete.mockResolvedValueOnce({ affected: 0 });
    await expect(service.remove('user-id', 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
