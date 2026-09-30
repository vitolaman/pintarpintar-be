import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TransactionsQueryDto } from './dto/recent-transactions.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderService } from './order.service';

describe('OrderService', () => {
  const order = {
    id: 'order-1',
    created_at: new Date('2026-09-30T00:00:00Z'),
    status: OrderStatus.PENDING,
    totalAmount: '299000',
    discountAmount: '0',
  };
  let manager: Record<string, jest.Mock>;
  let query: jest.Mock;
  let service: OrderService;

  beforeEach(() => {
    manager = {
      find: jest.fn(async () => [order]),
      findAndCount: jest.fn(async () => [[order], 11]),
    };
    query = jest.fn(async () => [
      {
        order_id: 'order-1',
        price: '299000',
        item_id: 'class-1',
        title: 'AutoCAD',
        type: 'kelas',
      },
    ]);
    service = new OrderService({ manager, query } as never);
  });

  it('lists only the caller orders with a status filter and pagination', async () => {
    const response = await service.findAll('user-id', {
      page: 2,
      limit: 10,
      status: OrderStatus.PENDING,
    });

    expect(manager.findAndCount).toHaveBeenCalledWith(Order, {
      where: { userId: 'user-id', status: 'pending' },
      order: { created_at: 'DESC', id: 'DESC' },
      skip: 10,
      take: 10,
    });
    expect(response.meta).toEqual({
      page: 2,
      limit: 10,
      total: 11,
      totalPage: 2,
    });
    expect(response.data[0]).toMatchObject({
      total_amount: 299000,
      items: [{ type: 'kelas', title: 'AutoCAD', price: 299000 }],
    });
  });

  it('keeps the recent list shape', async () => {
    const response = await service.findRecent('user-id', { limit: 3 });

    expect(response.data[0]).toMatchObject({
      id: 'order-1',
      status: 'pending',
    });
  });

  it.each([
    [{ limit: '51' }, true],
    [{ status: 'refunded' }, true],
    [{ page: '0' }, true],
    [{ page: '2', limit: '50', status: 'paid' }, false],
  ])('validates %j', async (input, hasErrors) => {
    const errors = await validate(plainToInstance(TransactionsQueryDto, input));
    expect(errors.length > 0).toBe(hasErrors);
  });
});
