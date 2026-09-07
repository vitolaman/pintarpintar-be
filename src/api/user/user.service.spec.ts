import { BadRequestException, ConflictException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

describe('UserService', () => {
  let repository: jest.Mocked<Partial<Repository<User>>>;
  let service: UserService;

  const user = {
    id: '06f7152e-7cc9-42f6-a4f0-8a84eb31e384',
    name: 'John Doe',
    email: 'john@example.com',
    passwordHash:
      '$2a$10$zI1nd0RSP99PsAmmM1gZhe3nLlN8PbePfaLYGvA2xKgsmGe98/tSC',
    created_at: new Date('2026-09-01T00:00:00.000Z'),
    updated_at: new Date('2026-09-01T00:00:00.000Z'),
    isMentor: false,
    isMerchant: false,
    deletedBy: null,
  } as User;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      exists: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    service = new UserService(repository as Repository<User>);
  });

  it('normalizes registration fields and stores a bcrypt password hash', async () => {
    repository.exists.mockResolvedValue(false);
    repository.create.mockImplementation((input) => input as User);
    repository.save.mockImplementation(
      (async (input) => ({ ...user, ...input }) as User) as never,
    );

    const created = await service.create({
      name: '  John Doe  ',
      email: '  JOHN@EXAMPLE.COM ',
      password: 'password1',
    });

    expect(created.name).toBe('John Doe');
    expect(created.email).toBe('john@example.com');
    expect(created.passwordHash).not.toBe('password1');
    await expect(compare('password1', created.passwordHash)).resolves.toBe(
      true,
    );
  });

  it('rejects duplicate normalized emails before creating a user', async () => {
    repository.exists.mockResolvedValue(true);

    await expect(
      service.create({
        name: 'John Doe',
        email: 'JOHN@EXAMPLE.COM',
        password: 'password1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only name after normalization', async () => {
    await expect(
      service.create({
        name: '   ',
        email: 'john@example.com',
        password: 'password1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns the current user without the password hash', async () => {
    repository.findOneBy.mockResolvedValue({ ...user });

    const result = await service.findCurrentUser(user.id);

    expect(result).toMatchObject({
      id: user.id,
      name: user.name,
      is_mentor: false,
      is_merchant: false,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('updates only the current user name after normalization', async () => {
    repository.findOneBy.mockResolvedValue({ ...user });
    repository.save.mockImplementation(
      (async (input) => ({ ...user, ...input }) as User) as never,
    );

    const result = await service.updateCurrentUser(user.id, '  Jane Doe  ');

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: user.id, name: 'Jane Doe' }),
    );
    expect(result).toMatchObject({ id: user.id, name: 'Jane Doe' });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('soft-deletes the current user, records the actor, and returns no hash', async () => {
    repository.findOneBy.mockResolvedValue({ ...user });
    repository.save.mockImplementation(async (input) => input as User);
    repository.softDelete.mockResolvedValue({} as never);

    const result = await service.deleteCurrentUser(user.id);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ deletedBy: user.id }),
    );
    expect(repository.softDelete).toHaveBeenCalledWith(user.id);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).toMatchObject({ id: user.id, email: user.email });
  });
});
