import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  CatalogItemRefDto,
  referenceId,
  toReferenceColumns,
} from '~/common/catalog/catalog-item';
import { RecentTransactionsQueryDto } from '../order/dto/recent-transactions.dto';
import { OrderService } from '../order/order.service';
import { WishlistService } from '../wishlist/wishlist.service';
import { CartService } from './cart.service';
import { CartItem } from './entities/cart-item.entity';

const ID = '10000000-0000-4000-8000-000000000001';

const catalogRow = (override: Record<string, unknown> = {}) => ({
  type: 'kelas',
  id: ID,
  title: 'Belajar AutoCAD dari Nol',
  image: null,
  price: '299000',
  original_price: '350000',
  merchant_id: 'merchant-id',
  merchant_name: 'Akademi Teknik Budi',
  merchant_slug: 'akademi-teknik-budi',
  is_available: true,
  merchant_active: true,
  ...override,
});

describe('catalog item references', () => {
  it.each([
    ['kelas', { classId: ID, productId: null, bundleId: null }],
    ['bootcamp', { classId: ID, productId: null, bundleId: null }],
    ['digital', { classId: null, productId: ID, bundleId: null }],
    ['bundle', { classId: null, productId: null, bundleId: ID }],
  ])('maps %s to one reference column', (type, columns) => {
    const ref = { type, id: ID } as CatalogItemRefDto;
    expect(toReferenceColumns(ref)).toEqual(columns);
    expect(referenceId(columns)).toBe(ID);
  });

  it('rejects unknown types and non-uuid ids', async () => {
    expect(
      await validate(
        plainToInstance(CatalogItemRefDto, { type: 'voucher', id: ID }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CatalogItemRefDto, { type: 'kelas', id: 'x' }),
      ),
    ).not.toHaveLength(0);
  });
});

describe('CartService', () => {
  let manager: Record<string, jest.Mock>;
  let service: CartService;

  beforeEach(() => {
    manager = {
      query: jest.fn(),
      findOneBy: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((_target, value) => ({ ...value })),
      save: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new CartService({
      manager,
      transaction: jest.fn((callback) => callback(manager)),
    } as unknown as DataSource);
  });

  const add = () =>
    service.add('user-id', { type: 'kelas', id: ID } as CatalogItemRefDto);

  it('adds an available, unowned item', async () => {
    manager.query
      .mockResolvedValueOnce([catalogRow()])
      .mockResolvedValueOnce([{ owned: false }]);
    await add();
    expect(manager.save).toHaveBeenCalledWith(
      CartItem,
      expect.objectContaining({
        userId: 'user-id',
        classId: ID,
        productId: null,
      }),
    );
  });

  it('rejects unavailable, mistyped, and owned items', async () => {
    manager.query.mockResolvedValueOnce([catalogRow({ is_available: false })]);
    await expect(add()).rejects.toThrow(/not available/);

    manager.query.mockResolvedValueOnce([catalogRow({ type: 'bootcamp' })]);
    await expect(add()).rejects.toThrow(/not available/);

    manager.query
      .mockResolvedValueOnce([catalogRow()])
      .mockResolvedValueOnce([{ owned: true }]);
    await expect(add()).rejects.toThrow(/already own/);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('reports duplicates, including a concurrent unique violation, as 409', async () => {
    manager.query
      .mockResolvedValueOnce([catalogRow()])
      .mockResolvedValueOnce([{ owned: false }]);
    manager.findOneBy.mockResolvedValueOnce({ id: 'existing' });
    await expect(add()).rejects.toBeInstanceOf(ConflictException);

    manager.query
      .mockResolvedValueOnce([catalogRow()])
      .mockResolvedValueOnce([{ owned: false }]);
    manager.save.mockRejectedValueOnce(
      Object.assign(new QueryFailedError('INSERT', [], new Error('dup')), {
        code: '23505',
      }),
    );
    await expect(add()).rejects.toBeInstanceOf(ConflictException);
  });

  it('excludes unavailable items from the subtotal', async () => {
    manager.find.mockResolvedValue([
      {
        id: 'a',
        classId: ID,
        productId: null,
        bundleId: null,
        addedAt: new Date(),
      },
      {
        id: 'b',
        classId: null,
        productId: 'p',
        bundleId: null,
        addedAt: new Date(),
      },
    ]);
    manager.query.mockResolvedValue([
      catalogRow(),
      catalogRow({
        id: 'p',
        type: 'digital',
        price: '125000',
        is_available: false,
      }),
    ]);

    const { data } = await service.findCart('user-id');
    expect(data.item_count).toBe(2);
    expect(data.subtotal).toBe(299000);
  });

  it('returns 404 when removing another user entry', async () => {
    manager.delete.mockResolvedValueOnce({ affected: 0 });
    await expect(service.remove('user-id', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('WishlistService', () => {
  let manager: Record<string, jest.Mock>;
  let service: WishlistService;

  beforeEach(() => {
    manager = {
      query: jest.fn(async (sql: string) =>
        sql.includes('advisory') ? undefined : [catalogRow()],
      ),
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((_target, value) => ({ ...value })),
      save: jest.fn(async (_target, value) => ({
        id: 'entry',
        addedAt: new Date(),
        ...value,
      })),
    };
    service = new WishlistService({
      manager,
      transaction: jest.fn((callback) => callback(manager)),
    } as unknown as DataSource);
  });

  it('adds once and returns the existing entry afterwards', async () => {
    const first = await service.add('user-id', {
      type: 'kelas',
      id: ID,
    } as CatalogItemRefDto);
    expect(first.responseMessage).toBe('Add to wishlist success');
    expect(first.data.item.merchant_slug).toBe('akademi-teknik-budi');

    manager.findOneBy.mockResolvedValueOnce({
      id: 'entry',
      classId: ID,
      addedAt: new Date(),
    });
    const second = await service.add('user-id', {
      type: 'kelas',
      id: ID,
    } as CatalogItemRefDto);
    expect(second.responseMessage).toBe('Item already in wishlist');
    expect(manager.save).toHaveBeenCalledTimes(1);
  });

  it('rejects unavailable items', async () => {
    manager.query.mockImplementation(async (sql: string) =>
      sql.includes('advisory')
        ? undefined
        : [catalogRow({ is_available: false })],
    );
    await expect(
      service.add('user-id', { type: 'kelas', id: ID } as CatalogItemRefDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OrderService recent transactions', () => {
  it('clamps the limit to 1–20 and defaults it to 3', async () => {
    for (const [limit, expected] of [
      ['0', 1],
      ['21', 20],
      ['', 3],
      ['5', 5],
    ] as const) {
      const dto = plainToInstance(RecentTransactionsQueryDto, { limit });
      expect(dto.limit).toBe(expected);
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it('returns the newest orders with typed items', async () => {
    const orders = [
      {
        id: 'o2',
        created_at: new Date('2026-09-29'),
        status: 'pending',
        totalAmount: '125000',
        discountAmount: '0',
      },
      {
        id: 'o1',
        created_at: new Date('2026-09-20'),
        status: 'paid',
        totalAmount: '899000',
        discountAmount: '0',
      },
    ];
    const limit = jest.fn();
    const builder = {
      addSelect: () => builder,
      where: () => builder,
      orderBy: () => builder,
      addOrderBy: () => builder,
      limit: (value: number) => {
        limit(value);
        return builder;
      },
      getRawAndEntities: async () => ({
        entities: orders,
        raw: orders.map((order) => ({
          purchase_id: order.id,
          effective_status: order.status,
        })),
      }),
    };
    const query = jest.fn().mockResolvedValue([
      {
        order_id: 'o1',
        price: '899000',
        item_id: 'b',
        title: 'Paket Estimator',
        type: 'bundle',
      },
      {
        order_id: 'o2',
        price: '125000',
        item_id: 'p',
        title: 'Template DWG',
        type: 'digital',
      },
    ]);
    const service = new OrderService({
      manager: { createQueryBuilder: () => builder },
      query,
    } as unknown as DataSource);

    const { data } = await service.findRecent('user-id', { limit: 3 });

    expect(limit).toHaveBeenCalledWith(3);
    expect(
      data.map((order) => [order.id, order.status, order.items[0].type]),
    ).toEqual([
      ['o2', 'pending', 'digital'],
      ['o1', 'paid', 'bundle'],
    ]);
  });
});
