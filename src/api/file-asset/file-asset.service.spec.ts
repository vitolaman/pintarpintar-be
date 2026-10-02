import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { FileAsset } from '../profile/entities/file-asset.entity';
import { FileAssetService, originalFilename } from './file-asset.service';
import {
  assertFileFitsPurpose,
  assertOwnedAsset,
  purposeVisibility,
} from './asset-purpose-rules';

const USER_ID = '30000000-0000-4000-8000-000000000001';
const KEY = `uploads/${USER_ID}/1790900000000-logo.png`;
const MB = 1024 * 1024;

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
    ['an oversize logo', 'merchant_logo', 'logo.png', 'image/png', 3 * MB],
    ['a PDF banner', 'merchant_banner', 'b.pdf', 'application/pdf', 1000],
    ['an avatar without a type', 'user_avatar', 'me.png', undefined, 1000],
    [
      'a 150 MB class resource',
      'class_resource',
      'big.pdf',
      'application/pdf',
      150 * MB,
    ],
    [
      'a 250 MB product file',
      'digital_file',
      'big.zip',
      'application/zip',
      250 * MB,
    ],
    [
      'a video as a class resource',
      'class_resource',
      'clip.mp4',
      'video/mp4',
      MB,
    ],
    [
      'an executable',
      'digital_file',
      'setup.exe',
      'application/octet-stream',
      MB,
    ],
    [
      'a PDF claiming to be an image',
      'digital_file',
      'doc.pdf',
      'image/png',
      MB,
    ],
    [
      'a cover sent as octet-stream',
      'class_cover',
      'cover.png',
      'application/octet-stream',
      MB,
    ],
    [
      'a 5 MB product cover',
      'product_cover',
      'cover.webp',
      'image/webp',
      5 * MB,
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
    ['submission_file', 'proyek.zip', 'application/zip', MB],
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
    ['submission_file', 'laporan.docx', 'application/octet-stream', MB],
    ['submission_file', 'arsip.rar', 'application/vnd.rar', MB],
    ['submission_file', 'besar.pdf', 'application/pdf', 21 * MB],
    ['submission_file', 'blob', 'application/pdf', MB],
    ['certificate_file', 'sertifikat.webp', 'image/webp', MB],
    ['certificate_file', 'sertifikat.pdf', 'application/pdf', 11 * MB],
    ['certificate_file', 'palsu.pdf', 'image/png', MB],
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

  it.each([
    ['cv.png', 'image/png', MB],
    ['cv.pdf', 'application/pdf', 11 * MB],
    ['cv.zip', 'application/zip', MB],
    ['cv.txt', 'text/plain', MB],
  ])('rejects %s', (filename, mimeType, sizeBytes) => {
    expect(() =>
      assertFileFitsPurpose('application_cv', {
        filename,
        mimeType,
        sizeBytes,
      }),
    ).toThrow(BadRequestException);
  });

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
  const manager = (value: unknown) =>
    ({
      findOneBy: jest.fn().mockResolvedValue(value),
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
      ),
    ).resolves.toMatchObject({ originalFilename: 'plan.dwg' });
  });

  it.each([
    ['a class cover as a product file', asset, 'digital_file'],
    ['a private file as a product cover', privateFile, 'product_cover'],
    [
      'a spreadsheet as a class resource',
      { ...privateFile, originalFilename: 'sheet.xlsx' },
      'class_resource',
    ],
  ])('rejects %s', async (_name, value, purpose) => {
    await expect(
      assertOwnedAsset(manager(value), USER_ID, 'asset-id', purpose as never),
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
    ['too large for a logo', asset, 'merchant_logo'],
    ['missing', null, 'merchant_logo'],
  ])('rejects %s', async (_name, value, purpose) => {
    await expect(
      assertOwnedAsset(manager(value), USER_ID, 'asset-id', purpose as never),
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
  const claimingManager = (stored: string) => {
    const update = jest.fn();
    const findOneBy = jest
      .fn()
      .mockResolvedValueOnce({ ...pending })
      .mockResolvedValueOnce({ ...pending, visibility: stored });
    return {
      update,
      findOneBy,
      manager: { update, findOneBy } as unknown as EntityManager,
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
      assertOwnedAsset(manager, USER_ID, 'asset-id', 'class_resource'),
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
    const { manager, update } = claimingManager('pending');
    await expect(
      assertOwnedAsset(manager, USER_ID, 'asset-id', 'application_cv'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
