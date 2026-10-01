import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
}));

import { AuthService } from '../auth/auth.service';
import { FileAsset } from '../profile/entities/file-asset.entity';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { Mentor } from './entities/mentor.entity';
import { MentorProfile } from './entities/mentor-profile.entity';
import { MentorDocumentStorageService } from './mentor-document-storage.service';
import { MentorService } from './mentor.service';

describe('MentorService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const mentorId = '20000000-0000-4000-8000-000000000001';
  const documents = {
    cv: {
      assetId: '30000000-0000-4000-8000-000000000001',
      objectKey: 'mentor-documents/cv.pdf',
      originalFilename: 'cv.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      checksumSha256: 'cv-checksum',
    },
    certificate: {
      assetId: '30000000-0000-4000-8000-000000000002',
      objectKey: 'mentor-documents/certificate.pdf',
      originalFilename: 'certificate.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      checksumSha256: 'certificate-checksum',
    },
  };
  const input = {
    name: 'Raka Wijaya',
    email: 'raka@example.com',
    password: 'password1',
    phone: '+62 812-3456-7890',
    headline: 'Praktisi teknik',
    bio: 'Berpengalaman mengajar.',
    expertise: 'Teknik mesin',
    experience_years: 5,
    education: 'S1 Teknik Mesin',
    portfolio_url: 'https://portfolio.example',
    linkedin_url: 'https://linkedin.com/in/raka',
  };

  let manager: Record<string, jest.Mock>;
  let dataSource: Pick<DataSource, 'transaction' | 'query'>;
  let mentorRepository: { findOneBy: jest.Mock; createQueryBuilder: jest.Mock };
  let users: { createWithManager: jest.Mock };
  let auth: { createTokenResponse: jest.Mock };
  let storage: Record<string, jest.Mock>;
  let service: MentorService;

  beforeEach(() => {
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
    users = { createWithManager: jest.fn() };
    auth = { createTokenResponse: jest.fn() };
    storage = {
      storeRequiredDocuments: jest.fn().mockResolvedValue(documents),
      storeReplacementDocuments: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
      signedDownloadUrl: jest
        .fn()
        .mockResolvedValue('https://signed.example/cv'),
    };
    service = new MentorService(
      dataSource as DataSource,
      mentorRepository as unknown as Repository<Mentor>,
      users as unknown as UserService,
      auth as unknown as AuthService,
      storage as unknown as MentorDocumentStorageService,
    );
  });

  it('creates user, mentor, private assets, and profile atomically on direct sign-up', async () => {
    const user = { id: userId, isMentor: true } as User;
    users.createWithManager.mockResolvedValue(user);
    manager.findOne.mockResolvedValue(null);
    manager.findOneBy.mockResolvedValue(null);
    auth.createTokenResponse.mockResolvedValue({
      responseMessage: 'Account Created!',
      data: { token: 'token' },
    });

    await expect(service.signUp(input, {})).resolves.toEqual({
      responseMessage: 'Account Created!',
      data: { token: 'token' },
    });

    expect(users.createWithManager).toHaveBeenCalledWith(manager, input, {
      isMentor: true,
    });
    expect(manager.save).toHaveBeenCalledWith(
      FileAsset,
      expect.arrayContaining([
        expect.objectContaining({
          uploadedByUserId: userId,
          visibility: 'private',
          storageProvider: 's3',
        }),
      ]),
    );
    expect(manager.save).toHaveBeenCalledWith(
      MentorProfile,
      expect.objectContaining({
        mentorId,
        cvAssetId: documents.cv.assetId,
        skillCertificateAssetId: documents.certificate.assetId,
      }),
    );
    expect(auth.createTokenResponse).toHaveBeenCalledWith(
      'Account Created!',
      userId,
    );
  });

  it('removes stored documents when direct sign-up cannot create a user', async () => {
    users.createWithManager.mockRejectedValue(new ConflictException());

    await expect(service.signUp(input, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(storage.remove).toHaveBeenCalledWith([
      documents.cv,
      documents.certificate,
    ]);
  });

  it('rejects an existing mentor before saving documents to the database', async () => {
    const user = { id: userId, isMentor: false } as User;
    manager.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ id: mentorId });

    await expect(service.register(userId, input, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(storage.remove).toHaveBeenCalledWith([
      documents.cv,
      documents.certificate,
    ]);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects a mentor who already has a profile', async () => {
    const user = { id: userId, isMentor: true } as User;
    manager.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ id: mentorId, status: 'active' })
      .mockResolvedValueOnce({ id: 'profile-id', mentorId });

    await expect(service.register(userId, input, {})).rejects.toBeInstanceOf(
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

    await expect(service.register(userId, input, {})).resolves.toMatchObject({
      data: { id: mentorId },
      responseMessage: 'Register mentor success',
    });
    expect(manager.save).not.toHaveBeenCalledWith(Mentor, expect.anything());
    expect(manager.save).toHaveBeenCalledWith(
      MentorProfile,
      expect.objectContaining({
        mentorId,
        cvAssetId: documents.cv.assetId,
        skillCertificateAssetId: documents.certificate.assetId,
      }),
    );
  });

  it('rejects completing an inactive mentor record', async () => {
    const user = { id: userId, isMentor: true } as User;
    manager.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ id: mentorId, status: 'suspended' });

    await expect(service.register(userId, input, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('replaces the CV, soft-deletes the old asset, and removes it from storage after commit', async () => {
    storage.storeReplacementDocuments.mockResolvedValue({ cv: documents.cv });
    manager.findOne.mockResolvedValue({ id: mentorId, userId });
    const mentorProfile = {
      mentorId,
      cvAssetId: 'old-cv-id',
      skillCertificateAssetId: 'old-cert-id',
    };
    manager.findOneBy.mockResolvedValue(mentorProfile);
    manager.findByIds = jest.fn().mockResolvedValue([
      {
        id: 'old-cv-id',
        storageProvider: 's3',
        objectKey: 'mentor-documents/old.pdf',
      },
    ]);
    manager.update = jest.fn().mockResolvedValue(undefined);
    manager.softDelete = jest.fn().mockResolvedValue(undefined);
    (dataSource.query as jest.Mock).mockResolvedValue([
      {
        kind: 'cv',
        asset_id: documents.cv.assetId,
        filename: 'cv.pdf',
        mime_type: 'application/pdf',
        size_bytes: '100',
        uploaded_at: new Date('2026-09-30T00:00:00.000Z'),
        storage_provider: 's3',
        object_key: documents.cv.objectKey,
      },
    ]);

    const response = await service.updateDocuments(userId, {
      cv: [{} as Express.Multer.File],
    });

    expect(mentorProfile.cvAssetId).toBe(documents.cv.assetId);
    expect(mentorProfile.skillCertificateAssetId).toBe('old-cert-id');
    expect(manager.softDelete).toHaveBeenCalledWith(expect.anything(), [
      'old-cv-id',
    ]);
    expect(storage.remove).toHaveBeenCalledWith([
      expect.objectContaining({ objectKey: 'mentor-documents/old.pdf' }),
    ]);
    expect(response.data).toEqual([
      expect.objectContaining({
        kind: 'cv',
        size_bytes: 100,
        download_url: 'https://signed.example/cv',
      }),
    ]);
  });

  it('removes the new upload when the replacement transaction fails', async () => {
    storage.storeReplacementDocuments.mockResolvedValue({ cv: documents.cv });
    manager.findOne.mockResolvedValue(null);

    await expect(
      service.updateDocuments(userId, { cv: [{} as Express.Multer.File] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.remove).toHaveBeenCalledWith([documents.cv]);
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
    expect(storage.signedDownloadUrl).not.toHaveBeenCalled();
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
});
