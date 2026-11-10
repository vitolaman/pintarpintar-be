import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { In } from 'typeorm';
import { CreateMerchantProRequestDto } from './dto/merchant-pro-request.dto';
import { MerchantProRequestService } from './merchant-pro-request.service';
import { queueInternalMerchantProRequestEmail } from '../email/events/internal-request-emails';

jest.mock('../email/events/internal-request-emails', () => ({
  queueInternalMerchantProRequestEmail: jest.fn(),
}));

describe('MerchantProRequestService', () => {
  let requests: Record<string, jest.Mock>;
  let users: Record<string, jest.Mock>;
  let service: MerchantProRequestService;
  let manager: { save: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    manager = {
      save: jest.fn(async (_entity, value) => ({ id: 'request-id', ...value })),
    };
    requests = {
      manager: {
        transaction: jest.fn((callback) => callback(manager)),
      } as never,
      findAndCount: jest.fn(async () => [[], 0]),
    };
    users = {
      findOneBy: jest.fn(async () => ({
        id: 'user-id',
        name: 'Alice',
        email: 'alice@example.com',
      })),
      find: jest.fn(async () => []),
    };
    service = new MerchantProRequestService(requests as never, users as never);
  });

  it('stores a request associated with the authenticated user', async () => {
    const result = await service.create('user-id', {
      message: 'Please contact me',
    });

    expect(manager.save).toHaveBeenCalledWith(expect.any(Function), {
      userId: 'user-id',
      message: 'Please contact me',
    });
    expect(queueInternalMerchantProRequestEmail).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: 'request-id', userId: 'user-id' }),
      expect.objectContaining({ id: 'user-id', email: 'alice@example.com' }),
    );
    expect(result.data).toMatchObject({
      user_id: 'user-id',
      user_name: 'Alice',
      user_email: 'alice@example.com',
      message: 'Please contact me',
    });
  });

  it('allows a request without a message and does not deduplicate', async () => {
    await service.create('user-id', {});
    await service.create('user-id', {});
    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(manager.save).toHaveBeenCalledWith(expect.any(Function), {
      userId: 'user-id',
      message: null,
    });
  });

  it('rejects a missing user', async () => {
    users.findOneBy.mockResolvedValue(null);
    await expect(service.create('missing', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('fails creation if queuing the notification fails', async () => {
    jest
      .mocked(queueInternalMerchantProRequestEmail)
      .mockRejectedValueOnce(new Error('queue down'));
    await expect(service.create('user-id', {})).rejects.toThrow('queue down');
  });

  it('lists all requests with pagination and requester details', async () => {
    requests.findAndCount.mockResolvedValue([
      [
        { id: 'request-1', userId: 'user-1', message: 'First' },
        { id: 'request-2', userId: 'user-2', message: null },
        { id: 'request-3', userId: null, message: null },
      ],
      7,
    ]);
    users.find.mockResolvedValue([
      { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
    ]);

    const result = await service.findAll(2, 3);
    expect(requests.findAndCount).toHaveBeenCalledWith({
      order: { created_at: 'DESC', id: 'DESC' },
      take: 3,
      skip: 3,
    });
    expect(users.find).toHaveBeenCalledWith({
      where: { id: In(['user-1', 'user-2']) },
    });
    expect(result.data).toMatchObject([
      {
        user_id: 'user-1',
        user_name: 'Alice',
        user_email: 'alice@example.com',
      },
      { user_id: 'user-2', user_name: null, user_email: null },
      { user_id: null, user_name: null, user_email: null },
    ]);
    expect(result.meta).toEqual({ page: 2, limit: 3, total: 7, total_page: 3 });
  });

  it('does not query users for an empty page', async () => {
    const result = await service.findAll();
    expect(users.find).not.toHaveBeenCalled();
    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      total_page: 0,
    });
  });
});

describe('CreateMerchantProRequestDto', () => {
  it.each([
    [{}, undefined],
    [{ message: null }, null],
    [{ message: '  ' }, null],
    [{ message: '  Please contact me  ' }, 'Please contact me'],
  ])('accepts and normalizes %j', async (input, message) => {
    const dto = plainToInstance(CreateMerchantProRequestDto, input);
    expect(dto.message).toBe(message);
    expect(await validate(dto)).toEqual([]);
  });

  it.each([{ message: 123 }, { message: 'a'.repeat(2001) }])(
    'rejects an invalid message',
    async (input) => {
      expect(
        await validate(plainToInstance(CreateMerchantProRequestDto, input)),
      ).not.toEqual([]);
    },
  );
});
