import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { CreateHelpTicketDto } from './dto/create-help-ticket.dto';
import { HelpTicketResponseDto } from './dto/help-ticket-response.dto';
import { HelpTicket } from './entities/help-ticket.entity';
import { paginationMeta } from '~/common/dto/response-meta.dto';
import { queueInternalHelpTicketEmail } from '../email/events/internal-request-emails';
import { isAdminUser } from '~/common/guard/admin-users';

@Injectable()
export class HelpTicketService {
  constructor(
    @InjectRepository(HelpTicket)
    private readonly helpTickets: Repository<HelpTicket>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async create(userId: string | null, input: CreateHelpTicketDto) {
    const user = userId ? await this.users.findOneBy({ id: userId }) : null;
    if (userId && !user) {
      throw new NotFoundException('User not found');
    }

    const created = await this.helpTickets.manager.transaction(
      async (manager) => {
        const ticket = await manager.save(HelpTicket, {
          userId,
          ticketType: input.ticket_type,
          message: input.message,
        });
        await queueInternalHelpTicketEmail(manager, ticket, user);
        return ticket;
      },
    );

    const data = this.toResponse(created, user?.name ?? null);

    return {
      data,
      responseMessage: 'Create help ticket success',
    };
  }

  // Admins see every ticket, including anonymous ones; anyone else only their own.
  async findAll(callerId: string, page = 1, limit = 10) {
    const [rows, total] = await this.helpTickets.findAndCount({
      where: isAdminUser(this.config, callerId) ? {} : { userId: callerId },
      order: { created_at: 'DESC', id: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    const userIds = [...new Set(rows.map((row) => row.userId).filter(Boolean))];
    const users = userIds.length
      ? await this.users.find({ where: { id: In(userIds) } })
      : [];
    const names = new Map(users.map((user) => [user.id, user.name]));

    return {
      data: rows.map((item) =>
        this.toResponse(
          item,
          item.userId ? (names.get(item.userId) ?? null) : null,
        ),
      ),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get help tickets success',
    };
  }

  async findOne(userId: string, id: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ticket = await this.helpTickets.findOne({
      where: { id, userId },
    });

    if (!ticket) {
      throw new NotFoundException('Help ticket not found');
    }

    return {
      data: this.toResponse(ticket, user.name),
      responseMessage: 'Get help ticket success',
    };
  }

  private toResponse(
    ticket: HelpTicket,
    userName: string | null,
  ): HelpTicketResponseDto {
    return {
      id: ticket.id,
      user_id: ticket.userId,
      user_name: userName,
      ticket_type: ticket.ticketType,
      message: ticket.message,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
    };
  }
}
