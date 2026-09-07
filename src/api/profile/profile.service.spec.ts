import { Repository } from 'typeorm';
import { ProfileService } from './profile.service';
import { FileAsset } from './entities/file-asset.entity';
import { IssuedCertificate } from './entities/issued-certificate.entity';
import { Product } from './entities/product.entity';
import { Profile } from './entities/profile.entity';
import { StudentProgress } from './entities/student-progress.entity';
import { UserAccess } from './entities/user-access.entity';
import { User } from '../user/entities/user.entity';

describe('ProfileService', () => {
  const userId = '06f7152e-7cc9-42f6-a4f0-8a84eb31e384';
  let service: ProfileService;
  let issuedCertificates: jest.Mocked<Partial<Repository<IssuedCertificate>>>;
  let userAccess: jest.Mocked<Partial<Repository<UserAccess>>>;
  let users: jest.Mocked<Partial<Repository<User>>>;

  beforeEach(() => {
    userAccess = { createQueryBuilder: jest.fn() };
    issuedCertificates = { createQueryBuilder: jest.fn() };
    users = { createQueryBuilder: jest.fn() };

    service = new ProfileService(
      { transaction: jest.fn() } as never,
      {} as Repository<FileAsset>,
      issuedCertificates as Repository<IssuedCertificate>,
      {} as Repository<Product>,
      {} as Repository<Profile>,
      {} as Repository<StudentProgress>,
      userAccess as Repository<UserAccess>,
      users as Repository<User>,
    );
  });

  it('returns active learning records with deterministic progress states', async () => {
    const query = chainableQuery([
      {
        access_id: 'access-not-started',
        product_id: 'product-not-started',
        title: 'PLC Programming',
        product_type: 'video_class',
        level: 'Pemula',
        cover_asset_id: null,
        cover_object_key: null,
        completion_percentage: '0',
        total_time_spent: '0',
        last_accessed_at: null,
        expires_at: null,
      },
      {
        access_id: 'access-complete',
        product_id: 'product-complete',
        title: 'AutoCAD',
        product_type: 'video_class',
        level: 'Menengah',
        cover_asset_id: 'asset-id',
        cover_object_key: 'course-covers/autocad.png',
        completion_percentage: '100',
        total_time_spent: '7200',
        last_accessed_at: new Date('2026-09-07T01:00:00.000Z'),
        expires_at: null,
      },
    ]);
    userAccess.createQueryBuilder.mockReturnValue(query as never);

    const response = await service.findLearning(userId);

    expect(response).toEqual({
      responseMessage: 'Get learning success',
      data: [
        expect.objectContaining({
          access_id: 'access-not-started',
          progress_status: 'not_started',
          completion_percentage: 0,
        }),
        expect.objectContaining({
          access_id: 'access-complete',
          progress_status: 'completed',
          completion_percentage: 100,
          total_time_spent: 7200,
        }),
      ],
    });
    expect(query.where).toHaveBeenCalledWith('access.user_id = :userId', {
      userId,
    });
    expect(query.leftJoin).toHaveBeenCalledTimes(2);
  });

  it('returns profile identity and server-side role capabilities', async () => {
    const query = chainableSingleQuery({
      id: userId,
      name: 'Budi Santoso',
      email: 'budi@example.com',
      is_mentor: true,
      is_merchant: false,
      avatar_asset_id: null,
      avatar_object_key: null,
      phone: '+62 812-3456-7890',
      headline: null,
      bio: null,
    });
    users.createQueryBuilder.mockReturnValue(query as never);

    await expect(service.findCurrent(userId)).resolves.toEqual({
      responseMessage: 'Get profile success',
      data: {
        id: userId,
        name: 'Budi Santoso',
        email: 'budi@example.com',
        is_mentor: true,
        is_merchant: false,
        avatar_asset_id: null,
        avatar_object_key: null,
        phone: '+62 812-3456-7890',
        headline: null,
        bio: null,
      },
    });
  });

  it('returns only active issued certificates for the authenticated user', async () => {
    const query = chainableCertificateQuery([
      {
        id: 'certificate-id',
        product_id: 'product-id',
        product_title: 'Arduino untuk Pemula',
        certificate_number: 'PP-2026-0001',
        issued_at: new Date('2026-09-07T01:00:00.000Z'),
        certificate_asset_id: 'certificate-asset-id',
        certificate_asset_object_key: 'certificates/PP-2026-0001.pdf',
      },
    ]);
    issuedCertificates.createQueryBuilder.mockReturnValue(query as never);

    await expect(service.findCertifications(userId)).resolves.toEqual({
      responseMessage: 'Get certifications success',
      data: [
        {
          id: 'certificate-id',
          product_id: 'product-id',
          product_title: 'Arduino untuk Pemula',
          certificate_number: 'PP-2026-0001',
          issued_at: new Date('2026-09-07T01:00:00.000Z'),
          certificate_asset_id: 'certificate-asset-id',
          certificate_asset_object_key: 'certificates/PP-2026-0001.pdf',
        },
      ],
    });
    expect(query.where).toHaveBeenCalledWith('certificate.user_id = :userId', {
      userId,
    });
    expect(query.andWhere).toHaveBeenCalledWith(
      'certificate.revoked_at IS NULL',
    );
    expect(query.orderBy).toHaveBeenCalledWith('certificate.issued_at', 'DESC');
  });

  it('creates a profile record while updating authenticated user-owned fields', async () => {
    const manager = {
      findOneBy: jest.fn((entity) => {
        if (entity === User) {
          return Promise.resolve({ id: userId, name: 'Budi Santoso' });
        }

        if (entity === Profile) {
          return Promise.resolve(null);
        }

        if (entity === FileAsset) {
          return Promise.resolve({
            id: 'asset-id',
            status: 'active',
            uploadedByUserId: userId,
          });
        }

        return Promise.resolve(null);
      }),
      create: jest.fn((_, input) => input),
      save: jest.fn((_, input) => Promise.resolve(input)),
    };
    const transaction = jest.fn((callback) => callback(manager));
    (
      service as unknown as { dataSource: { transaction: jest.Mock } }
    ).dataSource.transaction = transaction;
    users.createQueryBuilder.mockReturnValue(
      chainableSingleQuery({
        id: userId,
        name: 'Jane Santoso',
        email: 'jane@example.com',
        is_mentor: false,
        is_merchant: false,
        avatar_asset_id: 'asset-id',
        avatar_object_key: 'avatars/jane.png',
        phone: '+62 812-3456-7890',
        headline: 'Pelajar',
        bio: 'Belajar desain teknik.',
      }) as never,
    );

    await expect(
      service.updateCurrent(userId, {
        name: '  Jane Santoso  ',
        phone: '+62 812-3456-7890',
        headline: 'Pelajar',
        bio: 'Belajar desain teknik.',
        avatar_asset_id: 'asset-id',
      }),
    ).resolves.toMatchObject({
      responseMessage: 'Update profile success',
      data: expect.objectContaining({ name: 'Jane Santoso' }),
    });

    expect(manager.create).toHaveBeenCalledWith(
      Profile,
      expect.objectContaining({ userId }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      User,
      expect.objectContaining({ id: userId, name: 'Jane Santoso' }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      Profile,
      expect.objectContaining({
        userId,
        avatarAssetId: 'asset-id',
        phone: '+62 812-3456-7890',
      }),
    );
  });
});

function chainableQuery(rows: unknown[]) {
  const query = {
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
    select: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };

  Object.entries(query).forEach(([key, value]) => {
    if (key !== 'getRawMany') {
      (value as jest.Mock).mockReturnValue(query);
    }
  });

  return query;
}

function chainableSingleQuery(row: unknown) {
  const query = {
    leftJoin: jest.fn(),
    select: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    getRawOne: jest.fn().mockResolvedValue(row),
  };

  Object.entries(query).forEach(([key, value]) => {
    if (key !== 'getRawOne') {
      (value as jest.Mock).mockReturnValue(query);
    }
  });

  return query;
}

function chainableCertificateQuery(rows: unknown[]) {
  const query = {
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
    select: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };

  Object.entries(query).forEach(([key, value]) => {
    if (key !== 'getRawMany') {
      (value as jest.Mock).mockReturnValue(query);
    }
  });

  return query;
}
