import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateUserBodyDto } from './dto/create-user.req.dto';
import { User } from './entities/user.entity';

export type PublicUser = Pick<
  User,
  'id' | 'name' | 'email' | 'created_at' | 'updated_at'
>;

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

  async findForAuthentication(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email: this.normalizeEmail(email) },
    });
  }

  async findCurrentUser(id: string): Promise<PublicUser> {
    return this.toPublicUser(await this.findActiveEntity(id));
  }

  async updateCurrentUser(id: string, name: string): Promise<PublicUser> {
    const user = await this.findActiveEntity(id);
    user.name = this.normalizeName(name);

    return this.toPublicUser(await this.users.save(user));
  }

  async deleteCurrentUser(id: string): Promise<PublicUser> {
    const user = await this.findActiveEntity(id);
    user.deletedBy = id;
    await this.users.save(user);
    await this.users.softDelete(id);

    return this.toPublicUser(user);
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
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
