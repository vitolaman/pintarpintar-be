import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateHelpTicketDto } from './dto/create-help-ticket.dto';
import { HelpTicketType } from './entities/help-ticket.entity';
import { HelpTicketService } from './help-ticket.service';
import { queueInternalHelpTicketEmail } from '../email/events/internal-request-emails';

jest.mock('../email/events/internal-request-emails', () => ({
  queueInternalHelpTicketEmail: jest.fn(),
}));

describe('HelpTicketService', () => {
  const input = {
    ticket_type: HelpTicketType.SARAN,
    message: 'Tambah mode gelap.',
  };
  let helpTickets: Record<string, jest.Mock>;
  let users: Record<string, jest.Mock>;
  let service: HelpTicketService;
  let manager: { save: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    manager = {
      save: jest.fn(async (_entity, value) => ({ id: 'ticket-id', ...value })),
    };
    helpTickets = {
      manager: {
        transaction: jest.fn((callback) => callback(manager)),
      } as never,
      findAndCount: jest.fn(async () => [[], 0]),
    };
    users = {
      findOneBy: jest.fn(async () => ({ id: 'user-id', name: 'John' })),
      find: jest.fn(async () => []),
    };
    config = { get: jest.fn().mockReturnValue('ADMIN-ID') };
    service = new HelpTicketService(
      helpTickets as never,
      users as never,
      config as unknown as ConfigService,
    );
  });

  it('stores anonymous feedback without a user', async () => {
    const response = await service.create(null, input);

    expect(manager.save).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ userId: null, message: 'Tambah mode gelap.' }),
    );
    expect(queueInternalHelpTicketEmail).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ userId: null }),
      null,
    );
    expect(users.findOneBy).not.toHaveBeenCalled();
    expect(response.data).toMatchObject({ user_id: null, user_name: null });
  });

  it('links feedback to the signed-in user', async () => {
    const response = await service.create('user-id', input);

    expect(response.data).toMatchObject({
      user_id: 'user-id',
      user_name: 'John',
    });
    expect(queueInternalHelpTicketEmail).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ userId: 'user-id' }),
      expect.objectContaining({ id: 'user-id', name: 'John' }),
    );
  });

  it('fails creation if queuing the notification fails', async () => {
    jest
      .mocked(queueInternalHelpTicketEmail)
      .mockRejectedValueOnce(new Error('queue down'));
    await expect(service.create(null, input)).rejects.toThrow('queue down');
  });

  it('rejects a token for a missing user', async () => {
    users.findOneBy.mockResolvedValue(null);

    await expect(service.create('ghost-id', input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists tickets from all users and anonymous visitors to an admin, with their names', async () => {
    helpTickets.findAndCount.mockResolvedValue([
      [
        { id: '1', userId: 'user-1' },
        { id: '2', userId: 'user-2' },
        { id: '3', userId: null },
        { id: '4', userId: 'deleted-user' },
      ],
      4,
    ]);
    users.find.mockResolvedValue([
      { id: 'user-1', name: 'Alice' },
      { id: 'user-2', name: 'Bob' },
    ]);
    const response = await service.findAll('admin-id', 2, 4);

    expect(helpTickets.findAndCount).toHaveBeenCalledWith({
      where: {},
      order: { created_at: 'DESC', id: 'DESC' },
      take: 4,
      skip: 4,
    });
    expect(response.data.map((item) => item.user_name)).toEqual([
      'Alice',
      'Bob',
      null,
      null,
    ]);
    expect(response.meta).toEqual({
      page: 2,
      limit: 4,
      total: 4,
      total_page: 1,
    });
  });

  it.each([
    ['the ticket owner', 'user-1'],
    ['another user', 'user-2'],
  ])("lists only the caller's own tickets to %s", async (_caller, callerId) => {
    helpTickets.findAndCount.mockResolvedValue([
      [{ id: '1', userId: callerId }],
      1,
    ]);
    users.find.mockResolvedValue([{ id: callerId, name: 'Alice' }]);
    const response = await service.findAll(callerId, 1, 10);

    expect(helpTickets.findAndCount).toHaveBeenCalledWith({
      where: { userId: callerId },
      order: { created_at: 'DESC', id: 'DESC' },
      take: 10,
      skip: 0,
    });
    expect(response.data).toEqual([
      expect.objectContaining({ id: '1', user_id: callerId }),
    ]);
    expect(response.meta.total).toBe(1);
  });

  it('never lists anonymous tickets to a non-admin, and fails closed without admins', async () => {
    config.get.mockReturnValue(undefined);
    await service.findAll('admin-id');

    expect(helpTickets.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'admin-id' } }),
    );
  });
});

describe('CreateHelpTicketDto', () => {
  it('matches the ticket type ignoring case and trims the message', async () => {
    const dto = plainToInstance(CreateHelpTicketDto, {
      ticket_type: ' Kritik ',
      message: '  Aplikasi sering error. ',
    });
    expect(dto).toMatchObject({
      ticket_type: HelpTicketType.KRITIK,
      message: 'Aplikasi sering error.',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it.each([[''], ['   '], [null]])(
    'rejects a message of %j',
    async (message) => {
      const errors = await validate(
        plainToInstance(CreateHelpTicketDto, {
          ticket_type: 'saran',
          message,
        }),
      );
      expect(errors.map((error) => error.property)).toEqual(['message']);
    },
  );

  it('rejects an unknown ticket type', async () => {
    const errors = await validate(
      plainToInstance(CreateHelpTicketDto, {
        ticket_type: 'keluhan',
        message: 'Halo',
      }),
    );
    expect(errors.map((error) => error.property)).toEqual(['ticket_type']);
  });
});
