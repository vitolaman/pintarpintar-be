import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { CreateCertificationPartnershipRequestDto } from './dto/certification-partnership-request.dto';
import { CertificationPartnershipRequest } from './entities/certification-partnership-request.entity';
import { PartnershipRequestService } from './partnership-request.service';

const valid = {
  institution_name: ' Lembaga Sertifikasi Teknik ',
  profile: 'LSP bidang konstruksi',
  email: 'kerjasama@lembaga.id',
  phone: '0812 3456 7890',
};

const errorFields = async (input: object) =>
  (
    await validate(
      plainToInstance(CreateCertificationPartnershipRequestDto, {
        ...valid,
        ...input,
      }),
    )
  ).map((error) => error.property);

describe('CreateCertificationPartnershipRequestDto', () => {
  it('accepts the form and trims the institution name', async () => {
    const dto = plainToInstance(
      CreateCertificationPartnershipRequestDto,
      valid,
    );
    expect(await validate(dto)).toEqual([]);
    expect(dto.institution_name).toBe('Lembaga Sertifikasi Teknik');
  });

  it('treats a blank profile as none', async () => {
    const dto = plainToInstance(CreateCertificationPartnershipRequestDto, {
      ...valid,
      profile: '   ',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.profile).toBeNull();
  });

  it.each([
    [{ institution_name: '  ' }, 'institution_name'],
    [{ institution_name: 'x'.repeat(201) }, 'institution_name'],
    [{ profile: 'x'.repeat(2001) }, 'profile'],
    [{ email: 'lembaga@' }, 'email'],
    [{ email: undefined }, 'email'],
    [{ phone: '' }, 'phone'],
    [{ phone: '0'.repeat(33) }, 'phone'],
  ])('rejects %j', async (input, field) => {
    expect(await errorFields(input)).toEqual([field]);
  });
});

describe('PartnershipRequestService', () => {
  let saved: Partial<CertificationPartnershipRequest>[];
  let userExists: boolean;
  let service: PartnershipRequestService;

  beforeEach(() => {
    saved = [];
    userExists = true;
    const requests = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => {
        saved.push(value);
        return { ...value, id: 'request-1', created_at: new Date(0) };
      }),
    };
    const users = { existsBy: jest.fn(async () => userExists) };
    service = new PartnershipRequestService(
      requests as unknown as Repository<CertificationPartnershipRequest>,
      users as unknown as Repository<User>,
    );
  });

  it('stores a visitor request without a user', async () => {
    const response = await service.createCertificationRequest(null, {
      ...valid,
      profile: null,
    });
    expect(saved).toEqual([
      expect.objectContaining({ userId: null, profile: null }),
    ]);
    expect(response.data).toEqual({ id: 'request-1', created_at: new Date(0) });
  });

  it('links a signed-in request to its user', async () => {
    await service.createCertificationRequest('user-1', valid);
    expect(saved[0]).toMatchObject({
      userId: 'user-1',
      institutionName: valid.institution_name,
    });
  });

  it('refuses a token of a deleted account', async () => {
    userExists = false;
    await expect(
      service.createCertificationRequest('user-1', valid),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(saved).toEqual([]);
  });
});
