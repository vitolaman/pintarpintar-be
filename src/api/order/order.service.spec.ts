import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { classKindSql } from '~/common/catalog/item-kind';
import { TransactionsQueryDto } from './dto/recent-transactions.dto';
import { OrderStatus } from './entities/order.entity';
import { OrderService } from './order.service';

describe('OrderService', () => {
  const order = {
    id: 'order-1',
    orderNumber: 'ORD-20260930-0001',
    created_at: new Date('2026-09-30T00:00:00Z'),
    status: OrderStatus.PENDING,
    totalAmount: '299000',
    discountAmount: '0',
  };
  let builder: Record<string, jest.Mock>;
  let query: jest.Mock;
  let service: OrderService;

  beforeEach(() => {
    builder = {};
    for (const method of [
      'addSelect',
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'offset',
      'limit',
    ]) {
      builder[method] = jest.fn(() => builder);
    }
    builder.clone = jest.fn(() => builder);
    builder.getCount = jest.fn(async () => 11);
    // The overdue pending order reads as expired.
    builder.getRawAndEntities = jest.fn(async () => ({
      entities: [{ ...order }],
      raw: [{ purchase_id: 'order-1', effective_status: 'expired' }],
    }));
    query = jest.fn(async () => [
      {
        order_id: 'order-1',
        price: '299000',
        item_id: 'class-1',
        title: 'AutoCAD',
        type: 'kelas',
      },
    ]);
    service = new OrderService({
      manager: { createQueryBuilder: () => builder },
      query,
    } as never);
  });

  it('lists only the caller orders with a status filter and pagination', async () => {
    const response = await service.findAll('user-id', {
      page: 2,
      limit: 10,
      status: OrderStatus.PENDING,
    });

    expect(builder.where).toHaveBeenCalledWith('purchase.user_id = :userId', {
      userId: 'user-id',
    });
    expect(builder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("THEN 'expired' ELSE purchase.status END"),
      { status: 'pending' },
    );
    expect(builder.offset).toHaveBeenCalledWith(10);
    expect(builder.limit).toHaveBeenCalledWith(10);
    expect(response.meta).toEqual({
      page: 2,
      limit: 10,
      total: 11,
      total_page: 2,
    });
    expect(response.data[0]).toMatchObject({
      order_number: 'ORD-20260930-0001',
      total_amount: 299000,
      items: [{ type: 'kelas', title: 'AutoCAD', price: 299000 }],
    });
  });

  it('keeps the recent list shape', async () => {
    const response = await service.findRecent('user-id', { limit: 3 });

    expect(response.data[0]).toMatchObject({
      id: 'order-1',
      status: 'expired',
    });
  });

  it('adds each item cover URL and merchant name in one query for the page', async () => {
    const baseUrl = process.env.ASSET_PUBLIC_BASE_URL;
    process.env.ASSET_PUBLIC_BASE_URL = 'https://cdn.example.com';
    try {
      const orders = ['order-1', 'order-2', 'order-3'].map((id) => ({
        ...order,
        id,
      }));
      builder.getRawAndEntities.mockResolvedValue({
        entities: orders,
        raw: orders.map(({ id }) => ({
          purchase_id: id,
          effective_status: 'paid',
        })),
      });
      query.mockResolvedValue(
        orders.map(({ id }, index) => ({
          order_id: id,
          price: '299000',
          item_id: `item-${index}`,
          title: 'AutoCAD',
          image: index === 0 ? 'uploads/cover.png' : null,
          merchant_name: 'Akademi Teknik Budi',
          type: 'kelas',
        })),
      );

      const response = await service.findAll('user-id', {
        page: 1,
        limit: 10,
      });

      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0][1]).toEqual([
        ['order-1', 'order-2', 'order-3'],
      ]);
      expect(query.mock.calls[0][0]).toContain('= ANY($1::uuid[])');
      expect(response.data.map((entry) => entry.items[0])).toEqual([
        expect.objectContaining({
          image_url: 'https://cdn.example.com/uploads/cover.png',
          merchant_name: 'Akademi Teknik Budi',
        }),
        expect.objectContaining({
          image_url: null,
          merchant_name: 'Akademi Teknik Budi',
        }),
        expect.objectContaining({ image_url: null }),
      ]);
    } finally {
      process.env.ASSET_PUBLIC_BASE_URL = baseUrl;
      if (baseUrl === undefined) delete process.env.ASSET_PUBLIC_BASE_URL;
    }
  });

  it('adds the cover URL to the order detail items', async () => {
    const baseUrl = process.env.ASSET_PUBLIC_BASE_URL;
    process.env.ASSET_PUBLIC_BASE_URL = 'https://cdn.example.com';
    try {
      query
        .mockResolvedValueOnce([
          {
            price: '299000',
            discount_amount: '0',
            item_id: 'class-1',
            title: 'AutoCAD',
            image: 'uploads/cover.png',
            merchant_id: 'merchant-1',
            merchant_name: 'Akademi Teknik Budi',
            type: 'kelas',
          },
        ])
        .mockResolvedValueOnce([]);

      const detail = await service.findDetail('user-id', 'order-1');

      expect(detail.items[0]).toMatchObject({
        image_url: 'https://cdn.example.com/uploads/cover.png',
      });
      expect(detail.items[0]).not.toHaveProperty('image');
      expect(query.mock.calls[0][0]).toContain(
        `WHEN item.class_id IS NOT NULL THEN ${classKindSql('class.type')}`,
      );
    } finally {
      process.env.ASSET_PUBLIC_BASE_URL = baseUrl;
      if (baseUrl === undefined) delete process.env.ASSET_PUBLIC_BASE_URL;
    }
  });

  it('queries no items for an empty page', async () => {
    builder.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

    const response = await service.findRecent('user-id', { limit: 3 });

    expect(response.data).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    [{ limit: '51' }, false],
    [{ status: 'refunded' }, true],
    [{ status: 'cancelled' }, false],
    [{ page: '0' }, false],
    [{ page: '2', limit: '50', status: 'paid' }, false],
  ])('validates %j', async (input, hasErrors) => {
    const errors = await validate(plainToInstance(TransactionsQueryDto, input));
    expect(errors.length > 0).toBe(hasErrors);
  });
});
