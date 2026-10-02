import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateHelpTicketDto } from './dto/create-help-ticket.dto';
import { HelpTicketType } from './entities/help-ticket.entity';
import { HelpTicketService } from './help-ticket.service';

describe('HelpTicketService', () => {
  const input = {
    ticket_type: HelpTicketType.SARAN,
    message: 'Tambah mode gelap.',
  };
  let helpTickets: Record<string, jest.Mock>;
  let users: Record<string, jest.Mock>;
  let service: HelpTicketService;

  beforeEach(() => {
    helpTickets = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'ticket-id', ...value })),
      findAndCount: jest.fn(async () => [[], 0]),
    };
    users = {
      findOneBy: jest.fn(async () => ({ id: 'user-id', name: 'John' })),
    };
    service = new HelpTicketService(helpTickets as never, users as never);
  });

  it('stores anonymous feedback without a user', async () => {
    const response = await service.create(null, input);

    expect(helpTickets.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, message: 'Tambah mode gelap.' }),
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
  });

  it('rejects a token for a missing user', async () => {
    users.findOneBy.mockResolvedValue(null);

    await expect(service.create('ghost-id', input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("lists only the caller's own tickets", async () => {
    await service.findAll('user-id');

    expect(helpTickets.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-id' } }),
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
