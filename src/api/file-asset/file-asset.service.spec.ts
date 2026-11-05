import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { FileAsset } from '../profile/entities/file-asset.entity';
import {
  Merchant,
  MerchantStorageLevel,
} from '../merchant/entities/merchant.entity';
import { Class } from '~/class/entities/class.entity';
import { FileAssetService, originalFilename } from './file-asset.service';
import {
  assertFileFitsPurpose,
  assertOwnedAsset,
  assetFieldDescription,
  purposeVisibility,
  sizeLimitText,
} from './asset-purpose-rules';

const USER_ID = '30000000-0000-4000-8000-000000000001';
const KEY = `uploads/${USER_ID}/1790900000000-logo.png`;
const MB = 1024 * 1024;
const GB = 1024 * MB;
const OWNER = { merchantId: 'merchant-id' };
const OCTET = 'application/octet-stream';

describe('originalFilename', () => {
  it('drops the upload timestamp prefix', () => {
    expect(originalFilename(KEY)).toBe('logo.png');
    expect(originalFilename('uploads/banner.webp')).toBe('banner.webp');
  });
});

describe('FileAssetService.registerCompleted', () => {
  let manager: Record<string, jest.Mock>;
  let send: jest.Mock;
  let service: FileAssetService;

  beforeEach(() => {
    manager = {
      query: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_target, value) => ({ ...value })),
      save: jest.fn(async (_target, value) => ({ id: 'asset-id', ...value })),
    };
    service = new FileAssetService(
      {
        transaction: jest.fn((callback) => callback(manager)),
      } as unknown as DataSource,
      new ConfigService({ AWS_S3_BUCKET_NAME: 'bucket' }),
    );
    send = jest.fn();
    (service as unknown as { s3Client: { send: jest.Mock } }).s3Client = {
      send,
    };
  });

  it('records a pending asset from the stored metadata', async () => {
    send.mockResolvedValue({
      ContentType: 'image/PNG',
      ContentLength: 500_000,
    });

    await expect(
      service.registerCompleted(USER_ID, KEY),
    ).resolves.toMatchObject({ id: 'asset-id' });
    expect(manager.save).toHaveBeenCalledWith(
      FileAsset,
      expect.objectContaining({
        uploadedByUserId: USER_ID,
        storageProvider: 's3',
        objectKey: KEY,
        originalFilename: 'logo.png',
        mimeType: 'image/png',
        sizeBytes: '500000',
        visibility: 'pending',
        status: 'active',
      }),
    );
  });

  it('records any file type and size; field rules apply at attach', async () => {
    send.mockResolvedValue({
      ContentType: 'application/octet-stream',
      ContentLength: 3 * 1024 * MB,
    });
    await service.registerCompleted(
      USER_ID,
      `uploads/${USER_ID}/1790900000000-setup.exe`,
    );
    expect(manager.save).toHaveBeenCalledWith(
      FileAsset,
      expect.objectContaining({ originalFilename: 'setup.exe' }),
    );
  });

  it('maps a missing object to 400 and storage failures to 502', async () => {
    send.mockRejectedValueOnce({
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    });
    await expect(
      service.registerCompleted(USER_ID, KEY),
    ).rejects.toBeInstanceOf(BadRequestException);

    send.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(
      service.registerCompleted(USER_ID, KEY),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it.each([
    ['another user', KEY, '30000000-0000-4000-8000-000000000002'],
    ['a key outside uploads/', 'private/secret.png', USER_ID],
    ['a key without a user folder', 'uploads/1790900000000-logo.png', USER_ID],
  ])("rejects %s's key", async (_name, key, userId) => {
    await expect(service.registerCompleted(userId, key)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('returns the existing asset for its owner and rejects other owners', async () => {
    send.mockResolvedValue({ ContentType: 'image/png', ContentLength: 1000 });
    manager.findOne.mockResolvedValue({
      id: 'existing',
      uploadedByUserId: USER_ID,
      visibility: 'public',
      deleted_at: null,
    });
    await expect(
      service.registerCompleted(USER_ID, KEY),
    ).resolves.toMatchObject({ id: 'existing' });

    manager.findOne.mockResolvedValue({
      id: 'existing',
      uploadedByUserId: 'someone-else',
      deleted_at: null,
    });
    await expect(
      service.registerCompleted(USER_ID, KEY),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });
});

describe('field rules by purpose', () => {
  it.each([
    ['a 500 KB logo', 'merchant_logo', 'logo.png', 'image/png', 500_000],
    ['a 3 MB banner', 'merchant_banner', 'b.webp', 'image/webp', 3 * MB],
    [
      'a DWG sent as octet-stream',
      'class_resource',
      'plan.dwg',
      'application/octet-stream',
      5 * MB,
    ],
    [
      'a 100 MB assignment brief',
      'assignment_resource',
      'brief.pdf',
      'application/pdf',
      100 * MB,
    ],
    [
      'a 190 MB video product',
      'digital_file',
      'course.mp4',
      'video/mp4',
      190 * MB,
    ],
    [
      'a spreadsheet product',
      'digital_file',
      'budget.xlsx',
      'application/octet-stream',
      MB,
    ],
  ])('accepts %s', (_name, purpose, filename, mimeType, sizeBytes) => {
    expect(() =>
      assertFileFitsPurpose(purpose as never, {
        filename,
        mimeType,
        sizeBytes,
      }),
    ).not.toThrow();
  });

  it.each([
    ['an oversize logo', 'merchant_logo', 'logo.png', 'image/png', 6 * MB],
    [
      'a 6 MB product cover',
      'product_cover',
      'cover.webp',
      'image/webp',
      6 * MB,
    ],
  ])('rejects %s', (_name, purpose, filename, mimeType, sizeBytes) => {
    expect(() =>
      assertFileFitsPurpose(purpose as never, {
        filename,
        mimeType,
        sizeBytes,
      }),
    ).toThrow(BadRequestException);
  });
});

describe('learning file purposes', () => {
  it.each([
    ['submission_file', 'denah.dwg', 'application/octet-stream', 5 * MB],
    ['submission_file', 'tugas.pdf', 'application/pdf', 20 * MB],
    ['submission_file', 'gedung.rvt', 'application/octet-stream', 500 * MB],
    ['submission_file', 'proyek.zip', 'application/zip', MB],
    ['submission_file', 'laporan.docx', 'application/octet-stream', MB],
    ['submission_file', 'arsip.rar', 'application/vnd.rar', MB],
    ['submission_file', 'perhitungan.xlsx', 'application/octet-stream', 2 * MB],
    ['submission_file', 'model.rvt', 'application/octet-stream', 15 * MB],
    ['certificate_file', 'sertifikat.pdf', 'application/pdf', 10 * MB],
    ['certificate_file', 'sertifikat.jpg', 'image/jpeg', MB],
    ['certificate_file', 'sertifikat.png', 'image/png', MB],
  ])('accepts %s %s', (purpose, filename, mimeType, sizeBytes) => {
    expect(() =>
      assertFileFitsPurpose(purpose as never, {
        filename,
        mimeType,
        sizeBytes,
      }),
    ).not.toThrow();
  });

  it.each([
    ['submission_file', 'besar.pdf', 'application/pdf', 500 * MB + 1],
    ['submission_file', 'besar.rvt', 'application/octet-stream', 600 * MB],
    ['certificate_file', 'sertifikat.pdf', 'application/pdf', 11 * MB],
  ])('rejects %s %s', (purpose, filename, mimeType, sizeBytes) => {
    expect(() =>
      assertFileFitsPurpose(purpose as never, {
        filename,
        mimeType,
        sizeBytes,
      }),
    ).toThrow(BadRequestException);
  });

  it('stores learning files as private', () => {
    expect(purposeVisibility('submission_file')).toBe('private');
    expect(purposeVisibility('certificate_file')).toBe('private');
  });
});

describe('application CV purpose', () => {
  it.each([
    ['cv.pdf', 'application/pdf', 9 * MB],
    ['cv.pdf', 'application/pdf', 10 * MB],
    ['cv.doc', 'application/msword', MB],
    [
      'cv.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      MB,
    ],
  ])('accepts %s', (filename, mimeType, sizeBytes) => {
    expect(() =>
      assertFileFitsPurpose('application_cv', {
        filename,
        mimeType,
        sizeBytes,
      }),
    ).not.toThrow();
  });

  it.each([['cv.pdf', 'application/pdf', 11 * MB]])(
    'rejects %s',
    (filename, mimeType, sizeBytes) => {
      expect(() =>
        assertFileFitsPurpose('application_cv', {
          filename,
          mimeType,
          sizeBytes,
        }),
      ).toThrow(BadRequestException);
    },
  );

  it('accepts a registered mentor CV, which is a private PDF of the same user', async () => {
    const mentorCv = {
      id: 'mentor-cv',
      uploadedByUserId: USER_ID,
      status: 'active',
      visibility: 'private',
      storageProvider: 's3',
      objectKey: 'mentor-documents/mentor-cv.pdf',
      originalFilename: 'CV_Budi_Santoso.pdf',
      mimeType: 'application/pdf',
      sizeBytes: String(2 * MB),
    };
    const manager = {
      findOneBy: jest.fn().mockResolvedValue(mentorCv),
    } as unknown as EntityManager;

    await expect(
      assertOwnedAsset(manager, USER_ID, 'mentor-cv', 'application_cv'),
    ).resolves.toMatchObject({ id: 'mentor-cv' });
  });
});

describe('certificate signature purpose', () => {
  it.each([
    ['sign.png', 'image/png', 300 * 1024],
    ['sign.jpg', 'image/jpeg', MB],
    ['sign.webp', 'image/webp', 300 * 1024],
  ])('accepts %s', (filename, mimeType, sizeBytes) => {
    expect(() =>
      assertFileFitsPurpose('certificate_signature', {
        filename,
        mimeType,
        sizeBytes,
      }),
    ).not.toThrow();
  });

  it.each([['sign.png', 'image/png', 6 * MB]])(
    'rejects %s',
    (filename, mimeType, sizeBytes) => {
      expect(() =>
        assertFileFitsPurpose('certificate_signature', {
          filename,
          mimeType,
          sizeBytes,
        }),
      ).toThrow(BadRequestException);
    },
  );

  it('is private', () => {
    expect(purposeVisibility('certificate_signature')).toBe('private');
  });
});

describe('assertOwnedAsset', () => {
  const asset = {
    id: 'asset-id',
    uploadedByUserId: USER_ID,
    status: 'active',
    visibility: 'public',
    originalFilename: 'banner.png',
    mimeType: 'image/png',
    sizeBytes: String(3 * MB),
  };
  // Content purposes look up the owning merchant's level (Basic here).
  const manager = (value: unknown) =>
    ({
      // No content stored yet, so the storage quota is not reached.
      query: jest.fn(async () => [{ used_bytes: '0', counted: false }]),
      // No Pro periods, so the level's per-file limit applies.
      find: jest.fn(async () => []),
      findOneBy: jest.fn(async (entity) =>
        entity === Merchant
          ? { id: 'merchant-id', storageLevel: 'basic' }
          : value,
      ),
    }) as unknown as EntityManager;

  it('accepts an owned banner within 4 MB', async () => {
    await expect(
      assertOwnedAsset(manager(asset), USER_ID, 'asset-id', 'merchant_banner'),
    ).resolves.toMatchObject({ id: 'asset-id' });
  });

  const privateFile = {
    ...asset,
    visibility: 'private',
    originalFilename: 'plan.dwg',
    mimeType: 'application/octet-stream',
  };

  it('accepts an owned private DWG as a product file', async () => {
    await expect(
      assertOwnedAsset(
        manager(privateFile),
        USER_ID,
        'asset-id',
        'digital_file',
        OWNER,
      ),
    ).resolves.toMatchObject({ originalFilename: 'plan.dwg' });
  });

  it.each([
    ['a class cover as a product file', asset, 'digital_file'],
    ['a private file as a product cover', privateFile, 'product_cover'],
  ])('rejects %s', async (_name, value, purpose) => {
    await expect(
      assertOwnedAsset(
        manager(value),
        USER_ID,
        'asset-id',
        purpose as never,
        OWNER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    [
      'foreign owner',
      { ...asset, uploadedByUserId: 'other' },
      'merchant_banner',
    ],
    ['null owner', { ...asset, uploadedByUserId: null }, 'merchant_banner'],
    ['private', { ...asset, visibility: 'private' }, 'merchant_banner'],
    ['inactive', { ...asset, status: 'deleted' }, 'merchant_banner'],
    [
      'too large for a logo',
      { ...asset, sizeBytes: String(6 * MB) },
      'merchant_logo',
    ],
    ['missing', null, 'merchant_logo'],
  ])('rejects %s', async (_name, value, purpose) => {
    await expect(
      assertOwnedAsset(
        manager(value),
        USER_ID,
        'asset-id',
        purpose as never,
        OWNER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('assertOwnedAsset claims a pending asset', () => {
  const pending = {
    id: 'asset-id',
    uploadedByUserId: USER_ID,
    status: 'active',
    visibility: 'pending',
    originalFilename: 'cover.png',
    mimeType: 'image/png',
    sizeBytes: String(MB),
  };
  // `stored` is what the row holds after the conditional update ran.
  const claimingManager = (stored: string, sizeBytes = MB) => {
    const update = jest.fn();
    const file = { ...pending, sizeBytes: String(sizeBytes) };
    const assetReads = [file, { ...file, visibility: stored }];
    const findOneBy = jest.fn(async (entity) =>
      entity === Merchant
        ? { id: 'merchant-id', storageLevel: 'basic' }
        : assetReads.shift(),
    );
    return {
      update,
      findOneBy,
      manager: {
        update,
        findOneBy,
        find: jest.fn(async () => []),
        query: jest.fn(async () => [{ used_bytes: '0', counted: false }]),
      } as unknown as EntityManager,
    };
  };

  it('makes it public on its first public field', async () => {
    const { manager, update } = claimingManager('public');
    await expect(
      assertOwnedAsset(manager, USER_ID, 'asset-id', 'product_cover'),
    ).resolves.toMatchObject({ visibility: 'public' });
    expect(update).toHaveBeenCalledWith(
      FileAsset,
      { id: 'asset-id', visibility: 'pending' },
      { visibility: 'public' },
    );
  });

  it('makes it private on its first private field', async () => {
    const { manager, update } = claimingManager('private');
    await expect(
      assertOwnedAsset(manager, USER_ID, 'asset-id', 'class_resource', OWNER),
    ).resolves.toMatchObject({ visibility: 'private' });
    expect(update).toHaveBeenCalledWith(
      FileAsset,
      { id: 'asset-id', visibility: 'pending' },
      { visibility: 'private' },
    );
  });

  it('rejects it when a concurrent attach claimed the other visibility', async () => {
    const { manager } = claimingManager('private');
    await expect(
      assertOwnedAsset(manager, USER_ID, 'asset-id', 'product_cover'),
    ).rejects.toThrow('already used as a private file');
  });

  it('leaves it pending when the file does not fit the field', async () => {
    const { manager, update } = claimingManager('pending', 11 * MB);
    await expect(
      assertOwnedAsset(manager, USER_ID, 'asset-id', 'application_cv'),
    ).rejects.toThrow('The file must be 10 MB or smaller');
    expect(update).not.toHaveBeenCalled();
  });
});

describe('upload rule messages', () => {
  const image = (sizeBytes: number) => ({
    filename: 'avatar.png',
    mimeType: 'image/png',
    sizeBytes,
  });

  it('states a fixed size limit without the internal field key', () => {
    expect(() => assertFileFitsPurpose('user_avatar', image(6 * MB))).toThrow(
      new BadRequestException('The file must be 5 MB or smaller'),
    );
    expect(() =>
      assertFileFitsPurpose('user_avatar', image(5 * MB)),
    ).not.toThrow();
  });

  it('describes each field from its rule', () => {
    expect(assetFieldDescription('class_cover')).toBe(
      'An asset_id from POST /api/v1/upload/complete: any file type, up to 5 MB.',
    );
    expect(sizeLimitText('digital_file')).toBe(
      "the store's level limit (Basic 1 GB, Silver 5 GB, Gold 10 GB)",
    );
  });
});

describe('per-file limit by merchant level', () => {
  const content = (sizeBytes: number) => ({
    filename: 'modul.zip',
    mimeType: 'application/zip',
    sizeBytes,
  });
  const basic = { level: MerchantStorageLevel.BASIC, maxBytes: 1 * GB };
  const silver = { level: MerchantStorageLevel.SILVER, maxBytes: 5 * GB };

  it('names the level and its limit when a file is too large', () => {
    expect(() =>
      assertFileFitsPurpose('digital_file', content(1.5 * GB), basic),
    ).toThrow('The file must be 1 GB or smaller on the Basic merchant level');
  });

  it('allows the same file at Silver', () => {
    expect(() =>
      assertFileFitsPurpose('class_resource', content(1.5 * GB), silver),
    ).not.toThrow();
  });

  it('raises the old 100 and 200 MB caps to the level limit', () => {
    expect(() =>
      assertFileFitsPurpose('assignment_resource', content(150 * MB), basic),
    ).not.toThrow();
    expect(() =>
      assertFileFitsPurpose('digital_file', content(250 * MB), basic),
    ).not.toThrow();
  });

  it('accepts a 5 MB cover, banner and signature', () => {
    for (const purpose of [
      'product_cover',
      'class_cover',
      'merchant_banner',
      'merchant_landing_background',
      'certificate_signature',
    ] as const) {
      expect(() =>
        assertFileFitsPurpose(purpose, {
          filename: 'c.png',
          mimeType: 'image/png',
          sizeBytes: 5 * MB,
        }),
      ).not.toThrow();
    }
  });

  it('keeps fixed image caps whatever the level', () => {
    expect(() =>
      assertFileFitsPurpose(
        'product_cover',
        { filename: 'c.png', mimeType: 'image/png', sizeBytes: 6 * MB },
        { level: MerchantStorageLevel.GOLD, maxBytes: 10 * GB },
      ),
    ).toThrow(BadRequestException);
  });

  const asset = {
    id: 'asset-id',
    uploadedByUserId: USER_ID,
    status: 'active',
    visibility: 'private',
    originalFilename: 'modul.zip',
    mimeType: 'application/zip',
    sizeBytes: String(2 * GB),
  };
  const proPeriod = {
    status: 'active',
    startsAt: new Date(Date.now() - 86400000),
    endsAt: new Date(Date.now() + 86400000),
  };
  const classOf = (
    level: MerchantStorageLevel,
    { pro = false, usedBytes = 0 } = {},
  ) =>
    ({
      query: jest.fn(async () => [
        { used_bytes: String(usedBytes), counted: false },
      ]),
      // A Pro merchant has one period covering now.
      find: jest.fn(async () => (pro ? [proPeriod] : [])),
      findOneBy: jest.fn(async (entity) => {
        if (entity === Class) return { id: 'class-id', merchant_id: 'm' };
        if (entity === Merchant) return { id: 'm', storageLevel: level };
        return { ...asset };
      }),
    }) as unknown as EntityManager;

  it("checks a class material against the class merchant's level", async () => {
    await expect(
      assertOwnedAsset(
        classOf(MerchantStorageLevel.BASIC),
        USER_ID,
        'asset-id',
        'class_resource',
        { classId: 'class-id' },
      ),
    ).rejects.toThrow('1 GB or smaller on the Basic merchant level');
    await expect(
      assertOwnedAsset(
        classOf(MerchantStorageLevel.SILVER),
        USER_ID,
        'asset-id',
        'class_resource',
        { classId: 'class-id' },
      ),
    ).resolves.toMatchObject({ id: 'asset-id' });
  });

  it('lifts the per-file limit for a Pro merchant', async () => {
    await expect(
      assertOwnedAsset(
        classOf(MerchantStorageLevel.BASIC, { pro: true }),
        USER_ID,
        'asset-id',
        'class_resource',
        { classId: 'class-id' },
      ),
    ).resolves.toMatchObject({ id: 'asset-id' });
  });

  it('keeps the storage quota for a Pro merchant', async () => {
    await expect(
      assertOwnedAsset(
        classOf(MerchantStorageLevel.BASIC, { pro: true, usedBytes: 29 * GB }),
        USER_ID,
        'asset-id',
        'class_resource',
        { classId: 'class-id' },
      ),
    ).rejects.toThrow('Storage is full: the Basic level allows 30');
  });
});

// No field limits the file type (owner decision 2026-11-05); only sizes,
// ownership and visibility are checked.
describe('any file type in every field', () => {
  it.each([
    ['a PDF banner', 'merchant_banner', 'b.pdf', 'application/pdf'],
    ['an avatar without a reported type', 'user_avatar', 'me.png', undefined],
    ['a cover sent as octet-stream', 'class_cover', 'cover.png', OCTET],
    ['a DWG cover', 'product_cover', 'denah.dwg', OCTET],
    [
      'a web page as a group image',
      'community_group_image',
      'p.html',
      'text/html',
    ],
    ['a program as a class material', 'class_resource', 'setup.exe', OCTET],
    ['an uppercase program as a product', 'digital_file', 'setup.EXE', OCTET],
    ['an Android app as a product', 'digital_file', 'aplikasi.apk', OCTET],
    [
      'a script as an assignment brief',
      'assignment_resource',
      'run.bat',
      OCTET,
    ],
    ['a PDF reported as an image', 'digital_file', 'doc.pdf', 'image/png'],
    ['a file without an extension', 'digital_file', 'README', OCTET],
    [
      'a web page as a submission',
      'submission_file',
      'jawaban.pdf',
      'text/html',
    ],
    ['a submission named blob', 'submission_file', 'blob', 'application/pdf'],
    ['a PDF as a class video', 'class_video', 'materi.pdf', 'application/pdf'],
    ['a Revit model as a class video', 'class_video', 'gedung.rvt', OCTET],
    ['a WEBP certificate', 'certificate_file', 'sertifikat.webp', 'image/webp'],
    ['a PNG CV', 'application_cv', 'cv.png', 'image/png'],
    ['a ZIP CV', 'application_cv', 'cv.zip', 'application/zip'],
    ['a PDF signature', 'certificate_signature', 'sign.pdf', 'application/pdf'],
    ['a GIF signature', 'certificate_signature', 'sign.gif', 'image/gif'],
    [
      'an installer as a community attachment',
      'community_attachment',
      'app.msi',
      OCTET,
    ],
  ])('accepts %s', (_label, purpose, filename, mimeType) => {
    expect(() =>
      assertFileFitsPurpose(purpose as never, {
        filename,
        mimeType,
        sizeBytes: 1024,
      }),
    ).not.toThrow();
  });

  it('still applies the size limit to any type', () => {
    expect(() =>
      assertFileFitsPurpose('class_cover', {
        filename: 'cover.exe',
        mimeType: OCTET,
        sizeBytes: 6 * MB,
      }),
    ).toThrow('The file must be 5 MB or smaller');
  });
});

describe('submission size', () => {
  it('states the 500 MB limit', () => {
    expect(() =>
      assertFileFitsPurpose('submission_file', {
        filename: 'model.rvt',
        mimeType: 'application/octet-stream',
        sizeBytes: 500 * MB + 1,
      }),
    ).toThrow('The file must be 500 MB or smaller');
  });
});
