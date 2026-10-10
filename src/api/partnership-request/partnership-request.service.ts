import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import {
  CertificationPartnershipRequestResponseDto,
  CreateCertificationPartnershipRequestDto,
} from './dto/certification-partnership-request.dto';
import { CertificationPartnershipRequest } from './entities/certification-partnership-request.entity';

@Injectable()
export class PartnershipRequestService {
  constructor(
    @InjectRepository(CertificationPartnershipRequest)
    private readonly requests: Repository<CertificationPartnershipRequest>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  // Stored only: no email or status follows until the process is defined.
  async createCertificationRequest(
    userId: string | null,
    input: CreateCertificationPartnershipRequestDto,
  ) {
    if (userId && !(await this.users.existsBy({ id: userId }))) {
      throw new NotFoundException('User not found');
    }
    const saved = await this.requests.save(
      this.requests.create({
        institutionName: input.institution_name,
        profile: input.profile ?? null,
        email: input.email,
        phone: input.phone,
        userId,
      }),
    );
    const data: CertificationPartnershipRequestResponseDto = {
      id: saved.id,
      created_at: saved.created_at,
    };
    return {
      data,
      responseMessage: 'Create certification partnership request success',
    };
  }
}
