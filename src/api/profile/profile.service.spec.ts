import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ProfileService } from './profile.service';
import { FileAsset } from './entities/file-asset.entity';
import { Product } from './entities/product.entity';
import { Profile } from './entities/profile.entity';
import { StudentProgress } from './entities/student-progress.entity';
import { User } from '../user/entities/user.entity';

describe('ProfileService', () => {
  const userId = '06f7152e-7cc9-42f6-a4f0-8a84eb31e384';
  let service: ProfileService;
  let dataSource: { transaction: jest.Mock; query: jest.Mock };
  let users: jest.Mocked<Partial<Repository<User>>>;

  beforeEach(() => {
    dataSource = { transaction: jest.fn(), query: jest.fn() };
    users = { createQueryBuilder: jest.fn() };

    service = new ProfileService(
      dataSource as never,
      {} as Repository<FileAsset>,
      {} as Repository<Product>,
      {} as Repository<Profile>,
      {} as Repository<StudentProgress>,
      users as Repository<User>,
      new ConfigService({ AWS_S3_BUCKET_NAME: 'bucket' }),
    );
  });

  it('lists digital access and class enrollments with progress states', async () => {
    dataSource.query.mockResolvedValueOnce([
      {
        access_id: 'enrollment-id',
        product_id: 'class-id',
        title: 'Bootcamp Revit',
        product_type: 'bootcamp',
        level: 'Pemula',
        cover_asset_id: 'asset-id',
        cover_object_key: 'uploads/revit.png',
        completion_percentage: 40,
        total_time_spent: '0',
        last_accessed_at: new Date('2026-09-08T01:00:00.000Z'),
        expires_at: null,
      },
      {
        access_id: 'access-not-started',
        product_id: 'product-not-started',
        title: 'Template RAB',
        product_type: 'digital',
        level: null,
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
        product_type: 'digital',
        level: 'Menengah',
        cover_asset_id: null,
        cover_object_key: null,
        completion_percentage: '100',
        total_time_spent: '7200',
        last_accessed_at: null,
        expires_at: null,
      },
    ]);

    const response = await service.findLearning(userId);

    expect(
      response.data.map((item) => [item.product_type, item.progress_status]),
    ).toEqual([
      ['bootcamp', 'in_progress'],
      ['digital', 'not_started'],
      ['digital', 'completed'],
    ]);
    expect(response.data[0]).toMatchObject({
      product_id: 'class-id',
      completion_percentage: 40,
      cover_object_key: 'uploads/revit.png',
    });
    expect(response.data[2].total_time_spent).toBe(7200);
    const [sql, params] = dataSource.query.mock.calls[0];
    expect(params).toEqual([userId]);
    expect(sql).toContain('FROM enrollments enrollment');
    expect(sql).toContain(
      "WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas'",
    );
    expect(sql).toContain('access.expires_at > now()');
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
      mentor_expertise: 'AutoCAD, SAP2000',
      member_since: new Date('2026-01-15T03:00:00.000Z'),
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
        member_since: new Date('2026-01-15T03:00:00.000Z'),
        avatar_url: null,
        expertise_list: ['AutoCAD', 'SAP2000'],
      },
    });
  });

  it('lists only issued class certificates for the authenticated user', async () => {
    dataSource.query.mockResolvedValue([
      {
        id: 'certificate-id',
        certificate_number: 'PP-2026-0001',
        issued_on: '2026-09-07',
        file_url: 'https://files.example.com/PP-2026-0001.pdf',
        class_id: 'class-id',
        class_title: 'Arduino untuk Pemula',
        issuer_name: 'Sari Digital Studio',
        mentor_name: 'Budi Santoso',
      },
    ]);

    await expect(service.findCertifications(userId)).resolves.toEqual({
      responseMessage: 'Get certifications success',
      data: [
        {
          id: 'certificate-id',
          certificate_number: 'PP-2026-0001',
          issued_on: '2026-09-07',
          class_id: 'class-id',
          class_title: 'Arduino untuk Pemula',
          issuer_name: 'Sari Digital Studio',
          file_url: 'https://files.example.com/PP-2026-0001.pdf',
          mentor_name: 'Budi Santoso',
          skills: [],
          final_score: null,
          grade: null,
        },
      ],
    });

    const [sql, params] = dataSource.query.mock.calls[0];
    expect(sql).toContain('certificate.status = $2');
    expect(sql).toContain('certificate.deleted_at IS NULL');
    expect(params).toEqual([userId, 'issued']);
  });

  it('counts enrolled classes by type, digital products, and issued certificates', async () => {
    dataSource.query.mockResolvedValue([
      {
        bootcamp_count: 2,
        video_class_count: 1,
        digital_product_count: 3,
        certificate_count: 1,
      },
    ]);

    await expect(service.findStatistics(userId)).resolves.toEqual({
      responseMessage: 'Get learning statistics success',
      data: {
        bootcamp_count: 2,
        video_class_count: 1,
        digital_product_count: 3,
        certificate_count: 1,
      },
    });
    expect(dataSource.query.mock.calls[0][1]).toEqual([userId, 'issued']);
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
