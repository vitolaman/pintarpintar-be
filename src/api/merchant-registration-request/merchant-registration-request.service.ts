import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { paginationMeta } from '~/common/dto/response-meta.dto';
import { queueInternalMerchantRegistrationRequestEmail } from '../email/events/internal-request-emails';
import { User } from '../user/entities/user.entity';
import {
  CreateMerchantRegistrationRequestDto,
  MerchantRegistrationRequestResponseDto,
} from './dto/merchant-registration-request.dto';
import { MerchantRegistrationRequest } from './entities/merchant-registration-request.entity';

@Injectable()
export class MerchantRegistrationRequestService {
  constructor(
    @InjectRepository(MerchantRegistrationRequest)
    private readonly requests: Repository<MerchantRegistrationRequest>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(userId: string, input: CreateMerchantRegistrationRequestDto) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');
    const request = await this.requests.manager.transaction(async (manager) => {
      const saved = await manager.save(MerchantRegistrationRequest, {
        userId,
        message: input.message ?? null,
      });
      await queueInternalMerchantRegistrationRequestEmail(manager, saved, user);
      return saved;
    });
    return {
      data: this.toResponse(request, user),
      responseMessage: 'Create merchant registration request success',
    };
  }

  async findAll(page = 1, limit = 10) {
    const [rows, total] = await this.requests.findAndCount({
      order: { created_at: 'DESC', id: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    const userIds = [...new Set(rows.map((row) => row.userId).filter(Boolean))];
    const users = userIds.length
      ? await this.users.find({ where: { id: In(userIds) } })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));
    return {
      data: rows.map((row) =>
        this.toResponse(
          row,
          row.userId ? usersById.get(row.userId) : undefined,
        ),
      ),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get merchant registration requests success',
    };
  }

  private toResponse(
    request: MerchantRegistrationRequest,
    user?: User,
  ): MerchantRegistrationRequestResponseDto {
    return {
      id: request.id,
      user_id: request.userId,
      user_name: user?.name ?? null,
      user_email: user?.email ?? null,
      message: request.message,
      created_at: request.created_at,
      updated_at: request.updated_at,
    };
  }
}
