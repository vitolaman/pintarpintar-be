import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { paginationMeta } from '~/common/dto/response-meta.dto';
import { User } from '../user/entities/user.entity';
import {
  CreateMerchantProRequestDto,
  MerchantProRequestResponseDto,
} from './dto/merchant-pro-request.dto';
import { MerchantProRequest } from './entities/merchant-pro-request.entity';

@Injectable()
export class MerchantProRequestService {
  constructor(
    @InjectRepository(MerchantProRequest)
    private readonly requests: Repository<MerchantProRequest>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(userId: string, input: CreateMerchantProRequestDto) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    const request = await this.requests.save(
      this.requests.create({ userId, message: input.message ?? null }),
    );
    return {
      data: this.toResponse(request, user),
      responseMessage: 'Create merchant Pro request success',
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
      responseMessage: 'Get merchant Pro requests success',
    };
  }

  private toResponse(
    request: MerchantProRequest,
    user?: User,
  ): MerchantProRequestResponseDto {
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
