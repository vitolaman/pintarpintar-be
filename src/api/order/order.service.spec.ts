import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
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
      totalPage: 2,
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
