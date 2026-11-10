import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { paginationMeta } from '~/common/dto/response-meta.dto';
import { User } from '../user/entities/user.entity';
import {
  CertificationRequestResponseDto,
  CreateCertificationRequestDto,
} from './dto/certification-request.dto';
import { CertificationRequest } from './entities/certification-request.entity';
import { queueInternalCertificationRequestEmail } from '../email/events/internal-request-emails';

@Injectable()
export class CertificationRequestService {
  constructor(
    @InjectRepository(CertificationRequest)
    private readonly requests: Repository<CertificationRequest>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(userId: string, input: CreateCertificationRequestDto) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    const request = await this.requests.manager.transaction(async (manager) => {
      const saved = await manager.save(CertificationRequest, {
        userId,
        organizationName: input.organization_name,
        organizationProfile: input.organization_profile ?? null,
        organizationEmail: input.organization_email,
        organizationPhone: input.organization_phone,
      });
      await queueInternalCertificationRequestEmail(manager, saved, user);
      return saved;
    });
    return {
      data: this.toResponse(request, user),
      responseMessage: 'Create certification request success',
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
      responseMessage: 'Get certification requests success',
    };
  }

  private toResponse(
    request: CertificationRequest,
    user?: User,
  ): CertificationRequestResponseDto {
    return {
      id: request.id,
      user_id: request.userId,
      user_name: user?.name ?? null,
      user_email: user?.email ?? null,
      organization_name: request.organizationName,
      organization_profile: request.organizationProfile,
      organization_email: request.organizationEmail,
      organization_phone: request.organizationPhone,
      requested_at: request.created_at,
      updated_at: request.updated_at,
    };
  }
}
