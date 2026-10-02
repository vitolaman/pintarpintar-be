import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  CatalogItemRefDto,
  referenceId,
  resolveItemReferences,
} from '~/common/catalog/catalog-item';
import { RecentTransactionsQueryDto } from '../order/dto/recent-transactions.dto';
import { OrderService } from '../order/order.service';
import { WishlistService } from '../wishlist/wishlist.service';
import { CartController } from './cart.controller';
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
  const managerFor = (family: string | null) =>
    ({
      query: jest.fn(async () => (family ? [{ id: ID, family }] : [])),
    }) as never;

  it.each([
    ['class', undefined, { classId: ID, productId: null, bundleId: null }],
    ['class', 'kelas', { classId: ID, productId: null, bundleId: null }],
    ['class', 'bootcamp', { classId: ID, productId: null, bundleId: null }],
    ['product', 'digital', { classId: null, productId: ID, bundleId: null }],
    ['bundle', undefined, { classId: null, productId: null, bundleId: ID }],
  ])('resolves a %s sent as %s', async (family, type, columns) => {
    const [resolved] = await resolveItemReferences(managerFor(family), [
      { id: ID, type: type as never },
    ]);
    expect(resolved).toEqual(columns);
    expect(referenceId(resolved)).toBe(ID);
  });

  it('rejects another family and an unknown id, naming the item', async () => {
    await expect(
      resolveItemReferences(managerFor('class'), [{ id: ID, type: 'digital' }]),
    ).rejects.toThrow(`Item ${ID} is a class, not digital`);
    await expect(
      resolveItemReferences(managerFor(null), [{ id: ID }]),
    ).rejects.toThrow(`Item ${ID} is not available`);
  });

  it('makes type optional, case-insensitive, and still validated', async () => {
    const errorsOf = async (input: object) =>
      validate(plainToInstance(CatalogItemRefDto, input));
    expect(await errorsOf({ id: ID })).toHaveLength(0);
    expect(
      plainToInstance(CatalogItemRefDto, { type: 'Bootcamp', id: ID }).type,
    ).toBe('bootcamp');
    expect(await errorsOf({ type: 'voucher', id: ID })).not.toHaveLength(0);
    expect(await errorsOf({ type: 'kelas', id: 'x' })).not.toHaveLength(0);
  });
});

// Routes the service's SQL to canned rows: the id lookup, the catalog
// details, and the ownership check.
const routedQuery =
  (rows: { family?: string; catalog?: object[]; owned?: boolean }) =>
  async (sql: string) => {
    if (sql.includes('AS family'))
      return [{ id: ID, family: rows.family ?? 'class' }];
    if (sql.includes('advisory')) return undefined;
    if (sql.includes('AS owned')) return [{ owned: rows.owned ?? false }];
    return rows.catalog ?? [catalogRow()];
  };

describe('CartService', () => {
  let manager: Record<string, jest.Mock>;
  let service: CartService;
  let deleted: { affected: number };
  let deleteWhere: jest.Mock;

  beforeEach(() => {
    deleted = { affected: 1 };
    deleteWhere = jest.fn();
    const deleteBuilder = {
      delete: jest.fn(() => deleteBuilder),
      from: jest.fn(() => deleteBuilder),
      where: jest.fn((...args) => {
        deleteWhere(...args);
        return deleteBuilder;
      }),
      andWhere: jest.fn((...args) => {
        deleteWhere(...args);
        return deleteBuilder;
      }),
      execute: jest.fn(async () => deleted),
    };
    manager = {
      query: jest.fn(routedQuery({})),
      findOneBy: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((_target, value) => ({ ...value })),
      save: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => deleteBuilder),
    };
    service = new CartService({
      manager,
      transaction: jest.fn((callback) => callback(manager)),
    } as unknown as DataSource);
  });

  const add = (ref: object = { id: ID }) =>
    service.add('user-id', ref as CatalogItemRefDto);

  it('adds an item by id alone, resolving its kind', async () => {
    manager.query.mockImplementation(
      routedQuery({ catalog: [catalogRow({ type: 'bootcamp' })] }),
    );
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

  it('accepts kelas for a bootcamp class', async () => {
    manager.query.mockImplementation(
      routedQuery({ catalog: [catalogRow({ type: 'bootcamp' })] }),
    );
    await add({ type: 'kelas', id: ID });
    expect(manager.save).toHaveBeenCalled();
  });

  it('rejects unavailable, wrong-family, and owned items', async () => {
    manager.query.mockImplementation(
      routedQuery({ catalog: [catalogRow({ is_available: false })] }),
    );
    await expect(add()).rejects.toThrow(/not available/);

    manager.query.mockImplementation(routedQuery({ family: 'bundle' }));
    await expect(add({ type: 'digital', id: ID })).rejects.toThrow(
      /is a bundle, not digital/,
    );

    manager.query.mockImplementation(routedQuery({ owned: true }));
    await expect(add()).rejects.toThrow(/already own/);
    expect(manager.save).not.toHaveBeenCalled();
  });

  const cartEntry = {
    id: 'entry',
    classId: ID,
    productId: null,
    bundleId: null,
    addedAt: new Date(),
  };

  it('returns the cart with created for a new item', async () => {
    manager.find.mockResolvedValue([cartEntry]);

    const response = await add();

    expect(response).toMatchObject({
      created: true,
      responseMessage: 'Add to cart success',
      data: { item_count: 1, subtotal: 299000 },
    });
  });

  it('returns the unchanged cart for an item already in it', async () => {
    manager.findOneBy.mockResolvedValueOnce({ id: 'entry' });
    manager.find.mockResolvedValue([cartEntry]);

    const response = await add();

    expect(manager.save).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      created: false,
      responseMessage: 'Item already in cart',
      data: { item_count: 1, items: [{ id: 'entry' }] },
    });
  });

  it('returns the cart when a concurrent add wins the unique index', async () => {
    manager.save.mockRejectedValueOnce(
      Object.assign(new QueryFailedError('INSERT', [], new Error('dup')), {
        code: '23505',
      }),
    );
    manager.find.mockResolvedValue([cartEntry]);

    const response = await add();

    expect(response.created).toBe(false);
    expect(response.data.item_count).toBe(1);
  });

  it('rethrows other database errors', async () => {
    manager.save.mockRejectedValueOnce(
      Object.assign(new QueryFailedError('INSERT', [], new Error('fk')), {
        code: '23503',
      }),
    );
    await expect(add()).rejects.toBeInstanceOf(QueryFailedError);
  });

  it('includes the public cover URL of each item', async () => {
    const baseUrl = process.env.ASSET_PUBLIC_BASE_URL;
    process.env.ASSET_PUBLIC_BASE_URL = 'https://cdn.example.com';
    try {
      manager.find.mockResolvedValue([cartEntry]);
      manager.query.mockResolvedValue([
        catalogRow({ image: 'uploads/cover.png' }),
      ]);

      const { data } = await service.findCart('user-id');

      expect(data.items[0].item).toMatchObject({
        image_url: 'https://cdn.example.com/uploads/cover.png',
      });
      expect(data.items[0].item).not.toHaveProperty('image');
    } finally {
      process.env.ASSET_PUBLIC_BASE_URL = baseUrl;
      if (baseUrl === undefined) delete process.env.ASSET_PUBLIC_BASE_URL;
    }
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

  it("removes the caller's entry by entry id or item id and returns the cart", async () => {
    manager.find.mockResolvedValue([cartEntry]);

    const response = await service.remove('user-id', ID);

    expect(response).toMatchObject({
      responseMessage: 'Remove cart item success',
      data: { item_count: 1, subtotal: 299000 },
    });
    expect(deleteWhere).toHaveBeenCalledWith('user_id = :userId', {
      userId: 'user-id',
    });
    expect(deleteWhere).toHaveBeenCalledWith(
      '(id = :id OR class_id = :id OR product_id = :id OR bundle_id = :id)',
      { id: ID },
    );
  });

  it('returns 404 when nothing of the caller matches', async () => {
    deleted = { affected: 0 };
    await expect(service.remove('user-id', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('clears the caller cart and returns it empty', async () => {
    const response = await service.clear('user-id');

    expect(manager.delete).toHaveBeenCalledWith(CartItem, {
      userId: 'user-id',
    });
    expect(response).toEqual({
      responseMessage: 'Clear cart success',
      data: { items: [], subtotal: 0, item_count: 0 },
    });
  });
});

describe('CartController add', () => {
  const cart = { items: [], subtotal: 0, item_count: 0 };

  it.each([
    [true, undefined],
    [false, 200],
  ])(
    'answers created=%s with status %s and the cart body',
    async (created, status) => {
      const service = {
        add: jest.fn(async () => ({
          created,
          data: cart,
          responseMessage: 'message',
        })),
      };
      const res = { status: jest.fn() };
      const controller = new CartController(service as never);

      const body = await controller.add(
        { user: { id: 'user-id' } },
        { id: ID } as CatalogItemRefDto,
        res as never,
      );

      expect(body).toEqual({ data: cart, responseMessage: 'message' });
      if (status) expect(res.status).toHaveBeenCalledWith(status);
      else expect(res.status).not.toHaveBeenCalled();
    },
  );
});

describe('WishlistService', () => {
  let manager: Record<string, jest.Mock>;
  let service: WishlistService;

  beforeEach(() => {
    manager = {
      query: jest.fn(routedQuery({})),
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

  it('adds once by id alone and returns the existing entry afterwards', async () => {
    const first = await service.add('user-id', { id: ID } as CatalogItemRefDto);
    expect(first.responseMessage).toBe('Add to wishlist success');
    expect(first.data.item.merchant_slug).toBe('akademi-teknik-budi');
    expect(first.data.item.image_url).toBeNull();

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
    manager.query.mockImplementation(
      routedQuery({ catalog: [catalogRow({ is_available: false })] }),
    );
    await expect(
      service.add('user-id', { id: ID } as CatalogItemRefDto),
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
