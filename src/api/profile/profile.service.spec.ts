import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FileAsset } from './entities/file-asset.entity';
import { Product } from './entities/product.entity';
import { Profile } from './entities/profile.entity';
import { StudentProgress } from './entities/student-progress.entity';
import { User } from '../user/entities/user.entity';

describe('ProfileService', () => {
  const userId = '06f7152e-7cc9-42f6-a4f0-8a84eb31e384';
  let service: ProfileService;
  let dataSource: {
    transaction: jest.Mock;
    query: jest.Mock;
    manager: { find: jest.Mock };
  };
  let users: jest.Mocked<Partial<Repository<User>>>;
  const mentorWorkspace = { findTeachingClasses: jest.fn() };

  beforeEach(() => {
    // No Pro periods unless a test adds them.
    dataSource = {
      transaction: jest.fn(),
      query: jest.fn(),
      manager: { find: jest.fn().mockResolvedValue([]) },
    };
    users = { createQueryBuilder: jest.fn() };

    service = new ProfileService(
      dataSource as never,
      {} as Repository<FileAsset>,
      {} as Repository<Product>,
      {} as Repository<Profile>,
      {} as Repository<StudentProgress>,
      users as Repository<User>,
      mentorWorkspace as never,
      new ConfigService({ AWS_S3_BUCKET_NAME: 'bucket' }),
    );
  });

  afterEach(() => {
    delete process.env.ASSET_PUBLIC_BASE_URL;
  });

  it('lists digital access and class enrollments with progress states', async () => {
    dataSource.query.mockResolvedValueOnce([
      {
        access_id: 'enrollment-id',
        item_id: 'class-id',
        title: 'Bootcamp Revit',
        item_type: 'bootcamp',
        level: 'Pemula',
        cover_object_key: 'uploads/revit.png',
        completion_percentage: 40,
        total_time_spent: '0',
        last_accessed_at: new Date('2026-09-08T01:00:00.000Z'),
        expires_at: null,
      },
      {
        access_id: 'access-not-started',
        item_id: 'product-not-started',
        title: 'Template RAB',
        item_type: 'digital',
        level: null,
        cover_object_key: null,
        completion_percentage: '0',
        total_time_spent: '0',
        last_accessed_at: null,
        expires_at: null,
      },
      {
        access_id: 'access-complete',
        item_id: 'product-complete',
        title: 'AutoCAD',
        item_type: 'digital',
        level: 'Menengah',
        cover_object_key: null,
        completion_percentage: '100',
        total_time_spent: '7200',
        last_accessed_at: null,
        expires_at: null,
      },
    ]);

    const response = await service.findLearning(userId);

    expect(
      response.data.map((item) => [item.item_type, item.progress_status]),
    ).toEqual([
      ['bootcamp', 'in_progress'],
      ['digital', 'not_started'],
      ['digital', 'completed'],
    ]);
    expect(response.data[0]).toMatchObject({
      item_id: 'class-id',
      item_type: 'bootcamp',
      completion_percentage: 40,
    });
    for (const removed of [
      'product_id',
      'product_type',
      'cover_asset_id',
      'cover_object_key',
    ]) {
      expect(response.data[0]).not.toHaveProperty(removed);
    }
    expect(response.data[2].total_time_spent).toBe(7200);
    const [sql, params] = dataSource.query.mock.calls[0];
    expect(params).toEqual([userId]);
    expect(sql).toContain('FROM enrollments enrollment');
    expect(sql).toContain(
      "(CASE WHEN class.type = 'live-bootcamp' THEN 'bootcamp' ELSE 'kelas' END)",
    );
    expect(sql).toContain("'digital' AS item_type");
    expect(sql).toContain('access.expires_at > now()');
  });

  it('builds a public profile without contact details', async () => {
    users.createQueryBuilder.mockReturnValue(
      chainableSingleQuery({
        id: userId,
        name: 'Budi Santoso',
        email: 'budi@example.com',
        is_mentor: true,
        is_merchant: true,
        avatar_asset_id: null,
        avatar_object_key: null,
        phone: '+62 812-3456-7890',
        headline: 'Structural engineer',
        bio: null,
        mentor_id: 'mentor-id',
        mentor_expertise: 'AutoCAD, SAP2000',
        merchant_id: 'merchant-id',
        member_since: new Date('2026-01-15T03:00:00.000Z'),
      }) as never,
    );
    dataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM merchants merchant')) {
        return [
          {
            id: 'merchant-id',
            store_name: 'Akademi Teknik',
            slug: 'akademi-teknik',
          },
        ];
      }
      if (sql.includes('AS bootcamp_count')) {
        return [
          {
            bootcamp_count: 1,
            video_class_count: 2,
            digital_product_count: 0,
            certificate_count: 1,
          },
        ];
      }
      if (sql.includes('FROM certificates certificate')) {
        return [
          {
            id: 'certificate-id',
            certificate_number: 'PP-CERT-2026-0001',
            issued_on: '2026-09-25',
            file_url: 'https://files.test/private.pdf',
            file_object_key: null,
            file_name: null,
            final_score: '88',
            class_id: 'class-id',
            class_title: 'AutoCAD',
            issuer_name: 'Akademi Teknik',
            mentor_name: 'Rina',
          },
        ];
      }
      if (sql.includes('AS students_count')) return [{ students_count: 40 }];
      return [];
    });
    mentorWorkspace.findTeachingClasses.mockResolvedValue({
      data: [
        { id: 'c1', title: 'AutoCAD', status: 'active' },
        { id: 'c2', title: 'Revit', status: 'inactive' },
      ],
    });

    const { data } = await service.findPublicProfile(userId);

    expect(data).toMatchObject({
      name: 'Budi Santoso',
      merchant: { id: 'merchant-id', slug: 'akademi-teknik' },
      mentor: { id: 'mentor-id', expertise_list: ['AutoCAD', 'SAP2000'] },
      learning_statistics: { video_class_count: 2, certificate_count: 1 },
      teaching_statistics: {
        classes_count: 2,
        active_classes_count: 1,
        students_count: 40,
      },
      certificates: [
        {
          certificate_number: 'PP-CERT-2026-0001',
          class_title: 'AutoCAD',
          mentor_name: 'Rina',
        },
      ],
    });
    const json = JSON.stringify(data);
    expect(json).not.toContain('budi@example.com');
    expect(json).not.toContain('3456');
    expect(json).not.toContain('private.pdf');
    expect(json).not.toContain('final_score');
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
      onboarding_role: 'professional',
      custom_role: null,
      skills: ['AutoCAD', 'BIM'],
      onboarding_completed_at: new Date('2026-01-15T04:00:00.000Z'),
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
        is_pro: false,
        pro_until: null,
        avatar_asset_id: null,
        phone: '+62 812-3456-7890',
        headline: null,
        bio: null,
        member_since: new Date('2026-01-15T03:00:00.000Z'),
        avatar_url: null,
        expertise_list: ['AutoCAD', 'SAP2000'],
        onboarding: {
          role: 'professional',
          custom_role: null,
          skills: ['AutoCAD', 'BIM'],
          completed_at: new Date('2026-01-15T04:00:00.000Z'),
        },
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
    process.env.ASSET_PUBLIC_BASE_URL = 'https://cdn.example.com';
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
            originalFilename: 'jane.png',
            mimeType: 'image/png',
            sizeBytes: '1024',
            visibility: 'public',
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
        name: 'Jane Santoso',
        phone: '+62 812-3456-7890',
        headline: 'Pelajar',
        bio: 'Belajar desain teknik.',
        avatar_asset_id: 'asset-id',
      }),
    ).resolves.toMatchObject({
      responseMessage: 'Update profile success',
      data: expect.objectContaining({
        name: 'Jane Santoso',
        avatar_asset_id: 'asset-id',
        avatar_url: 'https://cdn.example.com/avatars/jane.png',
      }),
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

describe('UpdateProfileDto', () => {
  const parse = (input: object) => plainToInstance(UpdateProfileDto, input);

  it('clears the phone, headline and bio with "" or null', async () => {
    const dto = parse({ phone: '', headline: null, bio: '   ' });
    expect(dto).toMatchObject({ phone: null, headline: null, bio: null });
    expect(await validate(dto)).toEqual([]);
  });

  it('trims the name and rejects a blank or null one', async () => {
    expect(parse({ name: '  Jane  ' }).name).toBe('Jane');
    for (const name of ['', '  ', null]) {
      const errors = await validate(parse({ name }));
      expect(errors.map((error) => error.property)).toEqual(['name']);
    }
  });
});
