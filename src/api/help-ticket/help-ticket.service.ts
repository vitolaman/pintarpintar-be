import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { CreateHelpTicketDto } from './dto/create-help-ticket.dto';
import { HelpTicketResponseDto } from './dto/help-ticket-response.dto';
import { HelpTicket } from './entities/help-ticket.entity';

@Injectable()
export class HelpTicketService {
  constructor(
    @InjectRepository(HelpTicket)
    private readonly helpTickets: Repository<HelpTicket>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(userId: string, input: CreateHelpTicketDto) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const created = await this.helpTickets.save(
      this.helpTickets.create({
        userId,
        ticketType: input.ticket_type,
        message: input.message,
      }),
    );

    const data = this.toResponse(created, user.name);

    return {
      data,
      responseMessage: 'Create help ticket success',
    };
  }

  async findAll(userId: string, page = 1, limit = 10) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [rows, total] = await this.helpTickets.findAndCount({
      where: { userId },
      order: { created_at: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      data: rows.map((item) => this.toResponse(item, user.name)),
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit),
      },
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

  private toResponse(ticket: HelpTicket, userName: string): HelpTicketResponseDto {
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
