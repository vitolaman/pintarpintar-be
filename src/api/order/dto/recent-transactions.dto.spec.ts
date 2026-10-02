import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';
import { TransactionsQueryDto } from './recent-transactions.dto';

describe('TransactionsQueryDto', () => {
  const parse = (input: object) => plainToInstance(TransactionsQueryDto, input);

  it('treats a blank status as no filter', async () => {
    const query = parse({ status: '' });

    expect(await validate(query)).toEqual([]);
    expect(query.status).toBeUndefined();
  });

  it('matches the status ignoring case and spaces', async () => {
    const query = parse({ status: ' Paid ' });

    expect(await validate(query)).toEqual([]);
    expect(query.status).toBe(OrderStatus.PAID);
  });

  it('rejects an unknown status', async () => {
    const errors = await validate(parse({ status: 'refunded' }));
    expect(errors.map((error) => error.property)).toEqual(['status']);
  });
});
