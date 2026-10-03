import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, Repository } from 'typeorm';

jest.mock('../file-asset/asset-purpose-rules', () => ({
  ...jest.requireActual('../file-asset/asset-purpose-rules'),
  assertOwnedAsset: jest.fn(),
}));
jest.mock('../../common/storage/signed-download-url', () => ({
  signedDownloadUrl: jest.fn().mockResolvedValue('https://signed.example/cv'),
}));

import { assertOwnedAsset } from '../file-asset/asset-purpose-rules';
import { signedDownloadUrl } from '../../common/storage/signed-download-url';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import {
  MentorRegisterDto,
  UpdateMentorDocumentsDto,
} from './dto/mentor-documents.dto';
import { MentorRegistrationDto } from './dto/mentor-registration.dto';
import { UpdateMentorDto } from './dto/update-mentor.dto';
import { Mentor } from './entities/mentor.entity';
import { MentorProfile } from './entities/mentor-profile.entity';
import { MentorService } from './mentor.service';

describe('MentorService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const mentorId = '20000000-0000-4000-8000-000000000001';
  const cvAssetId = '30000000-0000-4000-8000-000000000001';
  const certificateAssetId = '30000000-0000-4000-8000-000000000002';
  const input = {
    phone: '+62 812-3456-7890',
    headline: 'Praktisi teknik',
    bio: 'Berpengalaman mengajar.',
    expertise: 'Teknik mesin',
    experience_years: 5,
    education: 'S1 Teknik Mesin',
    portfolio_url: 'https://portfolio.example',
    linkedin_url: 'https://linkedin.com/in/raka',
    cv_asset_id: cvAssetId,
    skill_certificate_asset_id: certificateAssetId,
  } as MentorRegisterDto;

  let manager: Record<string, jest.Mock>;
  let dataSource: Pick<DataSource, 'transaction' | 'query'>;
  let mentorRepository: { findOneBy: jest.Mock; createQueryBuilder: jest.Mock };
  let service: MentorService;
  const claimed = assertOwnedAsset as jest.Mock;

  beforeEach(() => {
    claimed.mockReset().mockResolvedValue({});
    (signedDownloadUrl as jest.Mock).mockClear();
    manager = {
      create: jest.fn((target, value) => ({
        ...value,
        ...(target === Mentor ? { id: mentorId } : {}),
      })),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn().mockImplementation(async (_target, value) => value),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
      query: jest.fn(),
    } as unknown as Pick<DataSource, 'transaction' | 'query'>;
    mentorRepository = {
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    service = new MentorService(
      dataSource as DataSource,
      mentorRepository as unknown as Repository<Mentor>,
      new ConfigService({ AWS_S3_BUCKET_NAME: 'bucket' }),
    );
  });

  it('registers a new mentor with two uploaded documents', async () => {
    const user = { id: userId, isMentor: false } as User;
    manager.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    manager.findOneBy.mockResolvedValue(null);
    jest.spyOn(service, 'findProfile').mockResolvedValue({
      data: { id: mentorId } as never,
      responseMessage: 'Get mentor profile success',
    });

    await expect(service.register(userId, input)).resolves.toMatchObject({
      responseMessage: 'Register mentor success',
    });
    expect(claimed).toHaveBeenCalledWith(
      manager,
      userId,
      cvAssetId,
      'application_cv',
    );
    expect(claimed).toHaveBeenCalledWith(
      manager,
      userId,
      certificateAssetId,
      'certificate_file',
    );
    expect(manager.save).toHaveBeenCalledWith(
      MentorProfile,
      expect.objectContaining({
        mentorId,
        cvAssetId,
        skillCertificateAssetId: certificateAssetId,
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      User,
      expect.objectContaining({ isMentor: true }),
    );
  });

  it('rejects a foreign or wrong-type document and creates nothing', async () => {
    manager.findOne.mockResolvedValueOnce({ id: userId } as User);
    claimed.mockRejectedValueOnce(
      new BadRequestException('Allowed file types: PDF, DOC or DOCX'),
    );

    await expect(service.register(userId, input)).rejects.toThrow(
      'Allowed file types: PDF, DOC or DOCX',
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects the same file as CV and certificate', async () => {
    manager.findOne.mockResolvedValueOnce({ id: userId } as User);

    await expect(
      service.register(userId, {
        ...input,
        skill_certificate_asset_id: cvAssetId,
      } as MentorRegisterDto),
    ).rejects.toThrow('must be different files');
    expect(claimed).not.toHaveBeenCalled();
  });

  it('rejects an existing mentor', async () => {
    const user = { id: userId, isMentor: false } as User;
    manager.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ id: mentorId });

    await expect(service.register(userId, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects a mentor who already has a profile', async () => {
    const user = { id: userId, isMentor: true } as User;
    manager.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ id: mentorId, status: 'active' })
      .mockResolvedValueOnce({ id: 'profile-id', mentorId });

    await expect(service.register(userId, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('completes the mentor record of an accepted applicant', async () => {
    const user = { id: userId, isMentor: true } as User;
    manager.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ id: mentorId, status: 'active' })
      .mockResolvedValueOnce(null);
    manager.findOneBy.mockResolvedValue(null);
    jest.spyOn(service, 'findProfile').mockResolvedValue({
      data: { id: mentorId } as never,
      responseMessage: 'Get mentor profile success',
    });

    await expect(service.register(userId, input)).resolves.toMatchObject({
      data: { id: mentorId },
      responseMessage: 'Register mentor success',
    });
    expect(manager.save).not.toHaveBeenCalledWith(Mentor, expect.anything());
    expect(manager.save).toHaveBeenCalledWith(
      MentorProfile,
      expect.objectContaining({ mentorId, cvAssetId }),
    );
  });

  it('rejects completing an inactive mentor record', async () => {
    const user = { id: userId, isMentor: true } as User;
    manager.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ id: mentorId, status: 'suspended' });

    await expect(service.register(userId, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  describe('document replacement', () => {
    let mentorProfile: Record<string, string>;

    beforeEach(() => {
      manager.findOne.mockResolvedValue({ id: mentorId, userId });
      mentorProfile = {
        mentorId,
        cvAssetId: 'old-cv-id',
        skillCertificateAssetId: 'old-cert-id',
      };
      manager.findOneBy.mockResolvedValue(mentorProfile);
      (dataSource.query as jest.Mock).mockResolvedValue([
        {
          kind: 'cv',
          asset_id: cvAssetId,
          filename: 'cv.pdf',
          mime_type: 'application/pdf',
          size_bytes: '100',
          uploaded_at: new Date('2026-09-30T00:00:00.000Z'),
          storage_provider: 's3',
          object_key: 'uploads/cv.pdf',
        },
      ]);
    });

    it('replaces only the CV and checks only the new file', async () => {
      const response = await service.updateDocuments(userId, {
        cv_asset_id: cvAssetId,
      });

      expect(mentorProfile.cvAssetId).toBe(cvAssetId);
      expect(mentorProfile.skillCertificateAssetId).toBe('old-cert-id');
      expect(claimed).toHaveBeenCalledTimes(1);
      expect(claimed).toHaveBeenCalledWith(
        manager,
        userId,
        cvAssetId,
        'application_cv',
      );
      expect(response.data).toEqual([
        expect.objectContaining({
          kind: 'cv',
          size_bytes: 100,
          download_url: 'https://signed.example/cv',
        }),
      ]);
    });

    it('needs at least one document', async () => {
      await expect(service.updateDocuments(userId, {})).rejects.toThrow(
        'Send cv_asset_id, skill_certificate_asset_id, or both',
      );
    });

    it('is 404 without a mentor', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(
        service.updateDocuments(userId, { cv_asset_id: cvAssetId }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mentorProfile.cvAssetId).toBe('old-cv-id');
    });
  });

  it('gives no download URL for documents stored before S3 storage', async () => {
    (dataSource.query as jest.Mock).mockResolvedValue([
      {
        kind: 'skill_certificate',
        asset_id: 'legacy-id',
        filename: 'sertifikat.pdf',
        mime_type: 'application/pdf',
        size_bytes: '200',
        uploaded_at: new Date('2026-09-01T00:00:00.000Z'),
        storage_provider: 'local',
        object_key: 'mentor-documents/legacy.pdf',
      },
    ]);

    const response = await service.findDocuments(userId);

    expect(response.data[0].download_url).toBeNull();
    expect(signedDownloadUrl).not.toHaveBeenCalled();
  });

  it('rejects multipart file fields and accepts asset ids (strict bodies)', async () => {
    const strict = { whitelist: true, forbidNonWhitelisted: true };
    const errors = await validate(
      plainToInstance(MentorRegisterDto, { ...input, cv: 'file' }),
      strict,
    );
    expect(errors.map((error) => error.property)).toEqual(['cv']);
    expect(
      await validate(plainToInstance(MentorRegisterDto, input), strict),
    ).toEqual([]);
    const missing = await validate(
      plainToInstance(MentorRegisterDto, {
        ...input,
        cv_asset_id: undefined,
      }),
      strict,
    );
    expect(missing.map((error) => error.property)).toEqual(['cv_asset_id']);
    expect(
      (
        await validate(
          plainToInstance(UpdateMentorDocumentsDto, { cv_asset_id: null }),
          strict,
        )
      ).map((error) => error.property),
    ).toEqual(['cv_asset_id']);
  });

  it('stores an expertise list as comma-separated text', async () => {
    manager.findOne.mockResolvedValue({ id: mentorId, userId });
    const mentorProfile = { mentorId, expertise: 'Lama' };
    manager.findOneBy.mockImplementation(async (target) =>
      target === MentorProfile ? mentorProfile : { userId },
    );
    mentorRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        expertise: 'BIM, Revit',
        experience_years: '5',
      }),
    });

    const response = await service.updateMyMentor(userId, {
      expertise_list: [' BIM ', 'Revit', 'bim'],
    });

    expect(mentorProfile.expertise).toBe('BIM, Revit');
    expect(response.data.expertise_list).toEqual(['BIM', 'Revit']);
  });

  it('saves null for cleared headline, bio and portfolio link', async () => {
    manager.findOne.mockResolvedValue({ id: mentorId, userId });
    const mentorProfile = {
      mentorId,
      portfolioUrl: 'https://portfolio.example',
    };
    const profile = { userId, headline: 'Lama', bio: 'Lama', phone: '+62 1' };
    manager.findOneBy.mockImplementation(async (target) =>
      target === MentorProfile ? mentorProfile : profile,
    );
    mentorRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        expertise: 'BIM',
        experience_years: '5',
      }),
    });

    await service.updateMyMentor(userId, {
      headline: null,
      bio: null,
      portfolio_url: null,
    });

    expect(manager.save).toHaveBeenCalledWith(
      Profile,
      expect.objectContaining({ headline: null, bio: null, phone: '+62 1' }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      MentorProfile,
      expect.objectContaining({ portfolioUrl: null }),
    );
  });
});

describe('mentor request DTOs', () => {
  const registration = {
    phone: '+62 812-3456-7890',
    expertise: 'Teknik mesin',
    experience_years: '5',
    education: 'S1 Teknik Mesin',
    linkedin_url: 'https://linkedin.com/in/raka',
  };

  async function errorFields(target: new () => object, value: object) {
    const errors = await validate(plainToInstance(target, value));
    return errors.map((error) => error.property);
  }

  it('accepts multipart strings and clears blank optional fields', async () => {
    const dto = plainToInstance(MentorRegistrationDto, {
      ...registration,
      headline: '',
      bio: '   ',
      portfolio_url: '',
    });
    expect(dto).toMatchObject({
      experience_years: 5,
      headline: null,
      bio: null,
      portfolio_url: null,
    });
    expect(await validate(dto)).toEqual([]);
  });

  it.each([
    ['phone', ''],
    ['phone', '   '],
    ['expertise', ''],
    ['education', '  '],
    ['linkedin_url', ''],
    ['experience_years', ''],
    ['experience_years', 'lima'],
  ])('requires %s at registration, rejecting %j', async (field, value) => {
    expect(
      await errorFields(MentorRegistrationDto, {
        ...registration,
        [field]: value,
      }),
    ).toEqual([field]);
  });

  it('lets the profile update omit any field', async () => {
    expect(await errorFields(UpdateMentorDto, {})).toEqual([]);
    expect(
      plainToInstance(UpdateMentorDto, { experience_years: '' })
        .experience_years,
    ).toBeUndefined();
  });

  it.each([
    ['phone', null],
    ['phone', ''],
    ['expertise', null],
    ['education', '  '],
    ['linkedin_url', null],
    ['experience_years', null],
  ])('rejects clearing required %s with %j', async (field, value) => {
    expect(await errorFields(UpdateMentorDto, { [field]: value })).toEqual([
      field,
    ]);
  });

  it('clears headline, bio and portfolio link with null or ""', async () => {
    const dto = plainToInstance(UpdateMentorDto, {
      headline: null,
      bio: '',
      portfolio_url: null,
    });
    expect(dto).toMatchObject({
      headline: null,
      bio: null,
      portfolio_url: null,
    });
    expect(await validate(dto)).toEqual([]);
  });
});
