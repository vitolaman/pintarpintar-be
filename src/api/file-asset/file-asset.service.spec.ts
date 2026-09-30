import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import { FileAsset } from '../profile/entities/file-asset.entity';
import { RegisterUploadDto } from './dto/register-upload.dto';
import { FileAssetService, originalFilename } from './file-asset.service';
import { assertOwnedImageAsset } from './image-asset-rules';

const KEY = 'uploads/1790900000000-logo.png';
const MB = 1024 * 1024;

describe('RegisterUploadDto', () => {
  it.each([
    [{ key: KEY, purpose: 'merchant_logo' }, 0],
    [{ key: 'private/secret.png', purpose: 'merchant_logo' }, 1],
    [{ key: 'uploads/a/b.png', purpose: 'merchant_logo' }, 1],
    [{ key: KEY, purpose: 'product_cover' }, 1],
  ])('validates %j', async (input, errorCount) => {
    const errors = await validate(plainToInstance(RegisterUploadDto, input));
    expect(errors.length > 0).toBe(errorCount > 0);
  });
});

describe('originalFilename', () => {
  it('drops the upload timestamp prefix', () => {
    expect(originalFilename(KEY)).toBe('logo.png');
    expect(originalFilename('uploads/banner.webp')).toBe('banner.webp');
  });
});

describe('FileAssetService', () => {
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

  const register = (purpose: RegisterUploadDto['purpose'] = 'merchant_logo') =>
    service.registerUpload('user-id', { key: KEY, purpose });

  it('records a public image asset from the stored metadata', async () => {
    send.mockResolvedValue({
      ContentType: 'image/PNG',
      ContentLength: 500_000,
    });

    const { data } = await register();

    expect(manager.save).toHaveBeenCalledWith(
      FileAsset,
      expect.objectContaining({
        uploadedByUserId: 'user-id',
        storageProvider: 's3',
        objectKey: KEY,
        originalFilename: 'logo.png',
        mimeType: 'image/png',
        sizeBytes: '500000',
        visibility: 'public',
        status: 'active',
      }),
    );
    expect(data).toMatchObject({ id: 'asset-id', size_bytes: 500_000 });
  });

  it.each([
    [
      'oversize logo',
      { ContentType: 'image/png', ContentLength: 3 * MB },
      'merchant_logo',
    ],
    [
      'pdf',
      { ContentType: 'application/pdf', ContentLength: 1000 },
      'merchant_banner',
    ],
    ['missing type', { ContentLength: 1000 }, 'user_avatar'],
  ])('rejects %s', async (_name, head, purpose) => {
    send.mockResolvedValue(head);
    await expect(register(purpose as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('allows a 3 MB banner', async () => {
    send.mockResolvedValue({
      ContentType: 'image/webp',
      ContentLength: 3 * MB,
    });
    await expect(register('merchant_banner')).resolves.toBeDefined();
  });

  it('maps a missing object to 400 and storage failures to 502', async () => {
    send.mockRejectedValueOnce({
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    });
    await expect(register()).rejects.toBeInstanceOf(BadRequestException);

    send.mockRejectedValueOnce(new Error('socket hang up'));
    await expect(register()).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('returns the existing asset for its owner and rejects other users', async () => {
    send.mockResolvedValue({ ContentType: 'image/png', ContentLength: 1000 });
    manager.findOne.mockResolvedValue({
      id: 'existing',
      uploadedByUserId: 'user-id',
      objectKey: KEY,
      sizeBytes: '1000',
      deleted_at: null,
    });

    await expect(register()).resolves.toMatchObject({
      data: { id: 'existing' },
    });

    manager.findOne.mockResolvedValue({
      id: 'existing',
      uploadedByUserId: 'someone-else',
    });
    await expect(register()).rejects.toBeInstanceOf(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });
});

describe('assertOwnedImageAsset', () => {
  const asset = {
    id: 'asset-id',
    uploadedByUserId: 'user-id',
    status: 'active',
    visibility: 'public',
    mimeType: 'image/png',
    sizeBytes: String(3 * MB),
  };
  const manager = (value: unknown) =>
    ({
      findOneBy: jest.fn().mockResolvedValue(value),
    }) as unknown as EntityManager;

  it('accepts an owned banner within 4 MB', async () => {
    await expect(
      assertOwnedImageAsset(
        manager(asset),
        'user-id',
        'asset-id',
        'merchant_banner',
      ),
    ).resolves.toBeUndefined();
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
      assertOwnedImageAsset(
        manager(value),
        'user-id',
        'asset-id',
        purpose as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
