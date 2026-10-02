import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { CreateUserBodyDto } from './dto/create-user.req.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';
import { Mentor } from '../mentor/entities/mentor.entity';
import { Merchant } from '../merchant/entities/merchant.entity';

// Public store, catalog and voucher queries show active merchants only.
const MERCHANT_INACTIVE = 'inactive';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(input: CreateUserBodyDto): Promise<User> {
    const name = this.normalizeName(input.name);
    const email = this.normalizeEmail(input.email);

    if (await this.users.exists({ where: { email } })) {
      throw new ConflictException('Email already registered');
    }

    try {
      return await this.users.save(
        this.users.create({
          name,
          email,
          passwordHash: await hash(input.password, 10),
        }),
      );
    } catch (error) {
      if (this.isDuplicateEmailError(error)) {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }
  }

  async createWithManager(
    manager: EntityManager,
    input: CreateUserBodyDto,
    options: { isMentor?: boolean } = {},
  ): Promise<User> {
    const name = this.normalizeName(input.name);
    const email = this.normalizeEmail(input.email);

    if (await manager.exists(User, { where: { email } })) {
      throw new ConflictException('Email already registered');
    }

    try {
      return await manager.save(
        User,
        manager.create(User, {
          name,
          email,
          passwordHash: await hash(input.password, 10),
          isMentor: options.isMentor ?? false,
        }),
      );
    } catch (error) {
      if (this.isDuplicateEmailError(error)) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async findForAuthentication(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email: this.normalizeEmail(email) },
    });
  }

  async findCurrentUser(id: string): Promise<UserResponseDto> {
    const raw = await this.users
      .createQueryBuilder('user')
      .leftJoin(
        Mentor,
        'mentor',
        'mentor.user_id = user.id AND mentor.deleted_at IS NULL',
      )
      .leftJoin(
        Merchant,
        'merchant',
        'merchant.user_id = user.id AND merchant.deleted_at IS NULL',
      )
      .select([
        'user.id AS id',
        'user.name AS name',
        'user.email AS email',
        'user.isMentor AS is_mentor',
        'user.isMerchant AS is_merchant',
        'user.created_at AS created_at',
        'user.updated_at AS updated_at',
        'mentor.id AS mentor_id',
        'merchant.id AS merchant_id',
      ])
      .where('user.id = :id', { id })
      .andWhere('user.deleted_at IS NULL')
      .getRawOne();

    if (!raw) {
      throw new NotFoundException('User not found');
    }

    return raw as UserResponseDto;
  }

  async updateCurrentUser(id: string, name: string): Promise<UserResponseDto> {
    const user = await this.findActiveEntity(id);
    user.name = this.normalizeName(name);
    await this.users.save(user);

    return this.findCurrentUser(id);
  }

  // The account is soft-deleted, which frees its email for a new sign-up
  // (emails are unique among active users only), and its merchant goes
  // inactive so the store and its items leave public pages. Buyers' access
  // rows are left untouched.
  // The response is the account as it was, read before the soft delete hides it.
  async deleteCurrentUser(id: string): Promise<UserResponseDto> {
    const user = await this.findActiveEntity(id);
    const deleted = await this.findCurrentUser(id);
    await this.users.manager.transaction(async (manager) => {
      user.deletedBy = id;
      await manager.save(User, user);
      await manager.softDelete(User, { id });
      await manager.update(
        Merchant,
        { userId: id },
        { status: MERCHANT_INACTIVE },
      );
    });

    return deleted;
  }

  private async findActiveEntity(id: string): Promise<User> {
    const user = await this.users.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private normalizeName(name: string): string {
    const normalized = name.trim();

    if (!normalized) {
      throw new BadRequestException('Name must not be empty');
    }

    return normalized;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isDuplicateEmailError(error: unknown): boolean {
    return (
      error instanceof QueryFailedError && error.driverError?.code === '23505'
    );
  }
}
