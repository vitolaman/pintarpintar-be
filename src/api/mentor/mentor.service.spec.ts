import { ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn(),
}));

import { AuthService } from '../auth/auth.service';
import { FileAsset } from '../profile/entities/file-asset.entity';
import { Profile } from '../profile/entities/profile.entity';
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
      absolutePath: '/private/cv.pdf',
      originalFilename: 'cv.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      checksumSha256: 'cv-checksum',
    },
    certificate: {
      assetId: '30000000-0000-4000-8000-000000000002',
      objectKey: 'mentor-documents/certificate.pdf',
      absolutePath: '/private/certificate.pdf',
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
  let storage: {
    storeRequiredDocuments: jest.Mock;
    remove: jest.Mock;
  };
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
      remove: jest.fn().mockResolvedValue(undefined),
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

    expect(users.createWithManager).toHaveBeenCalledWith(
      manager,
      input,
      { isMentor: true },
    );
    expect(manager.save).toHaveBeenCalledWith(
      FileAsset,
      expect.arrayContaining([
        expect.objectContaining({
          uploadedByUserId: userId,
          visibility: 'private',
          storageProvider: 'local',
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
});
