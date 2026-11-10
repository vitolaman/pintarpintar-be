import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { In } from 'typeorm';
import { CertificationRequestService } from './certification-request.service';
import { CreateCertificationRequestDto } from './dto/certification-request.dto';
import { queueInternalCertificationRequestEmail } from '../email/events/internal-request-emails';

jest.mock('../email/events/internal-request-emails', () => ({
  queueInternalCertificationRequestEmail: jest.fn(),
}));

const validInput = {
  organization_name: 'Lembaga Sertifikasi',
  organization_email: 'contact@example.com',
  organization_phone: '6281234567890',
};

describe('CertificationRequestService', () => {
  let requests: Record<string, jest.Mock>;
  let users: Record<string, jest.Mock>;
  let service: CertificationRequestService;
  let manager: { save: jest.Mock };
  const requestedAt = new Date('2026-11-07T10:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    manager = {
      save: jest.fn(async (_entity, value) => ({
        id: 'request-id',
        created_at: requestedAt,
        updated_at: requestedAt,
        ...value,
      })),
    };
    requests = {
      manager: {
        transaction: jest.fn((callback) => callback(manager)),
      } as never,
      findAndCount: jest.fn(async () => [[], 0]),
    };
    users = {
      findOneBy: jest.fn(async () => ({
        id: 'user-id',
        name: 'Alice',
        email: 'alice@example.com',
      })),
      find: jest.fn(async () => []),
    };
    service = new CertificationRequestService(
      requests as never,
      users as never,
    );
  });

  it('stores the organization and caller and returns the request time', async () => {
    const result = await service.create('user-id', {
      ...validInput,
      organization_profile: 'Training and certification',
    });
    expect(manager.save).toHaveBeenCalledWith(expect.any(Function), {
      userId: 'user-id',
      organizationName: 'Lembaga Sertifikasi',
      organizationProfile: 'Training and certification',
      organizationEmail: 'contact@example.com',
      organizationPhone: '6281234567890',
    });
    expect(queueInternalCertificationRequestEmail).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: 'request-id', userId: 'user-id' }),
      expect.objectContaining({ id: 'user-id', email: 'alice@example.com' }),
    );
    expect(result.data).toMatchObject({
      user_id: 'user-id',
      user_name: 'Alice',
      user_email: 'alice@example.com',
      ...validInput,
      organization_profile: 'Training and certification',
      requested_at: requestedAt,
    });
  });

  it('accepts an omitted profile and keeps repeated requests', async () => {
    await service.create('user-id', validInput);
    await service.create('user-id', validInput);
    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(manager.save).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ organizationProfile: null }),
    );
  });

  it('rejects a missing user before saving', async () => {
    users.findOneBy.mockResolvedValue(null);
    await expect(service.create('missing', validInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('fails creation if queuing the notification fails', async () => {
    jest
      .mocked(queueInternalCertificationRequestEmail)
      .mockRejectedValueOnce(new Error('queue down'));
    await expect(service.create('user-id', validInput)).rejects.toThrow(
      'queue down',
    );
  });

  it('paginates all requests and handles unavailable users', async () => {
    requests.findAndCount.mockResolvedValue([
      [
        { id: '1', userId: 'user-1', created_at: requestedAt },
        { id: '2', userId: 'user-2', created_at: requestedAt },
        { id: '3', userId: null, created_at: requestedAt },
      ],
      7,
    ]);
    users.find.mockResolvedValue([
      { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
    ]);
    const result = await service.findAll(2, 3);
    expect(requests.findAndCount).toHaveBeenCalledWith({
      order: { created_at: 'DESC', id: 'DESC' },
      take: 3,
      skip: 3,
    });
    expect(users.find).toHaveBeenCalledWith({
      where: { id: In(['user-1', 'user-2']) },
    });
    expect(result.data).toMatchObject([
      {
        user_id: 'user-1',
        user_name: 'Alice',
        user_email: 'alice@example.com',
        requested_at: requestedAt,
      },
      { user_id: 'user-2', user_name: null, user_email: null },
      { user_id: null, user_name: null, user_email: null },
    ]);
    expect(result.meta).toEqual({ page: 2, limit: 3, total: 7, total_page: 3 });
  });

  it('does not query users on an empty page', async () => {
    const result = await service.findAll();
    expect(users.find).not.toHaveBeenCalled();
    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      total_page: 0,
    });
  });
});

describe('CreateCertificationRequestDto', () => {
  it('trims text and normalizes the organization phone', async () => {
    const dto = plainToInstance(CreateCertificationRequestDto, {
      organization_name: '  Organization  ',
      organization_profile: '  Profile  ',
      organization_email: '  contact@example.com  ',
      organization_phone: '0812 3456 7890',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({
      organization_name: 'Organization',
      organization_profile: 'Profile',
      organization_email: 'contact@example.com',
      organization_phone: '6281234567890',
    });
  });

  it.each([undefined, null, '  '])('allows profile %j', async (profile) => {
    const dto = plainToInstance(CreateCertificationRequestDto, {
      ...validInput,
      organization_profile: profile,
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.organization_profile).toBe(
      profile === undefined ? undefined : null,
    );
  });

  it.each([
    [{ organization_name: undefined }, 'organization_name'],
    [{ organization_name: '  ' }, 'organization_name'],
    [{ organization_name: 'x'.repeat(201) }, 'organization_name'],
    [{ organization_profile: 'x'.repeat(2001) }, 'organization_profile'],
    [{ organization_email: undefined }, 'organization_email'],
    [{ organization_email: 'invalid' }, 'organization_email'],
    [{ organization_phone: undefined }, 'organization_phone'],
    [{ organization_phone: 'invalid' }, 'organization_phone'],
  ])('rejects invalid input %j', async (input, field) => {
    const dto = plainToInstance(CreateCertificationRequestDto, {
      ...validInput,
      ...input,
    });
    expect((await validate(dto)).map((error) => error.property)).toContain(
      field,
    );
  });
});
