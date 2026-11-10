import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { In } from 'typeorm';
import { queueInternalMerchantRegistrationRequestEmail } from '../email/events/internal-request-emails';
import { CreateMerchantRegistrationRequestDto } from './dto/merchant-registration-request.dto';
import { MerchantRegistrationRequestService } from './merchant-registration-request.service';

jest.mock('../email/events/internal-request-emails', () => ({
  queueInternalMerchantRegistrationRequestEmail: jest.fn(),
}));

describe('MerchantRegistrationRequestService', () => {
  let manager: { save: jest.Mock };
  let requests: {
    manager: { transaction: jest.Mock };
    findAndCount: jest.Mock;
  };
  let users: { findOneBy: jest.Mock; find: jest.Mock };
  let service: MerchantRegistrationRequestService;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = {
      save: jest.fn(async (_entity, value) => ({ id: 'request-id', ...value })),
    };
    requests = {
      manager: { transaction: jest.fn((callback) => callback(manager)) },
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    users = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
      }),
      find: jest.fn().mockResolvedValue([]),
    };
    service = new MerchantRegistrationRequestService(
      requests as never,
      users as never,
    );
  });

  it('saves an authenticated request and queues the internal email in its transaction', async () => {
    const result = await service.create('user-1', {
      message: 'Please contact me',
    });
    expect(manager.save).toHaveBeenCalledWith(expect.any(Function), {
      userId: 'user-1',
      message: 'Please contact me',
    });
    expect(queueInternalMerchantRegistrationRequestEmail).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: 'request-id' }),
      expect.objectContaining({ id: 'user-1' }),
    );
    expect(result.data).toMatchObject({
      user_id: 'user-1',
      user_name: 'Alice',
      user_email: 'alice@example.com',
    });
  });
  it('allows duplicate requests without a message', async () => {
    await service.create('user-1', {});
    await service.create('user-1', {});
    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(manager.save).toHaveBeenCalledWith(expect.any(Function), {
      userId: 'user-1',
      message: null,
    });
  });
  it('rejects missing users and notification failures', async () => {
    users.findOneBy.mockResolvedValueOnce(null);
    await expect(service.create('missing', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.save).not.toHaveBeenCalled();
    jest
      .mocked(queueInternalMerchantRegistrationRequestEmail)
      .mockRejectedValueOnce(new Error('queue down'));
    await expect(service.create('user-1', {})).rejects.toThrow('queue down');
  });
  it('lists all requests with paginated requester details', async () => {
    requests.findAndCount.mockResolvedValue([
      [
        { id: 'r1', userId: 'user-1' },
        { id: 'r2', userId: null },
      ],
      5,
    ]);
    users.find.mockResolvedValue([
      { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
    ]);
    const result = await service.findAll(2, 2);
    expect(requests.findAndCount).toHaveBeenCalledWith({
      order: { created_at: 'DESC', id: 'DESC' },
      take: 2,
      skip: 2,
    });
    expect(users.find).toHaveBeenCalledWith({ where: { id: In(['user-1']) } });
    expect(result.data).toMatchObject([
      { user_name: 'Alice' },
      { user_name: null },
    ]);
    expect(result.meta).toEqual({ page: 2, limit: 2, total: 5, total_page: 3 });
  });
});

describe('CreateMerchantRegistrationRequestDto', () => {
  it.each([{ message: ' hello ' }, { message: ' ' }, { message: null }, {}])(
    'accepts %j',
    async (input) => {
      expect(
        await validate(
          plainToInstance(CreateMerchantRegistrationRequestDto, input),
        ),
      ).toEqual([]);
    },
  );
  it.each([{ message: 123 }, { message: 'a'.repeat(2001) }])(
    'rejects %j',
    async (input) => {
      expect(
        await validate(
          plainToInstance(CreateMerchantRegistrationRequestDto, input),
        ),
      ).not.toEqual([]);
    },
  );
});
