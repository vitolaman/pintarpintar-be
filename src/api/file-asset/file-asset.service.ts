import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { DataSource } from 'typeorm';
import { FileAsset } from '../profile/entities/file-asset.entity';
import { createObjectStorage } from '../../common/storage/object-storage';
import { PENDING_VISIBILITY } from './asset-purpose-rules';
import { isOwnUploadKey } from '~/common/storage/upload-key';
import { uploadSizeCap, uploadTooLarge } from './upload-size-cap';

export const STORAGE_PROVIDER = 's3';

@Injectable()
export class FileAssetService {
  private readonly logger = new Logger(FileAssetService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    const storage = createObjectStorage(configService);
    this.s3Client = storage.client;
    this.bucketName = storage.bucket;
  }

  /**
   * Rejects a declared file size that no field could accept from this user,
   * before anything is stored.
   */
  async assertUploadSizeAllowed(
    userId: string,
    sizeBytes: number,
  ): Promise<void> {
    const cap = await uploadSizeCap(this.dataSource.manager, userId);
    if (sizeBytes > cap) throw uploadTooLarge(cap);
  }

  /**
   * Registers a completed upload of the caller as a pending file asset. The
   * first form field it is attached to decides whether it is public or
   * private (see `assertOwnedAsset`). Registering the same key again returns
   * the caller's existing asset.
   *
   * The stored size, not the size the client declared, must fit the
   * uploader's cap (`uploadSizeCap`); a larger object is deleted and the
   * request answers 400.
   */
  async registerCompleted(userId: string, key: string): Promise<FileAsset> {
    if (!isOwnUploadKey(key, userId)) {
      throw new ForbiddenException('This upload belongs to another user');
    }
    const { contentType, sizeBytes } = await this.readObject(key);
    const cap = await uploadSizeCap(this.dataSource.manager, userId);

    const registered = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `file-asset:${key}`,
      ]);
      const existing = await manager.findOne(FileAsset, {
        where: { storageProvider: STORAGE_PROVIDER, objectKey: key },
        withDeleted: true,
      });
      if (existing) {
        if (existing.uploadedByUserId !== userId || existing.deleted_at) {
          throw new ConflictException('This upload is already registered');
        }
        return existing;
      }
      if (sizeBytes > cap) return null;

      return manager.save(
        FileAsset,
        manager.create(FileAsset, {
          uploadedByUserId: userId,
          storageProvider: STORAGE_PROVIDER,
          objectKey: key,
          originalFilename: originalFilename(key),
          mimeType: (contentType ?? 'application/octet-stream').toLowerCase(),
          sizeBytes: String(sizeBytes),
          visibility: PENDING_VISIBILITY,
          status: 'active',
        }),
      );
    });
    if (registered) return registered;

    await this.deleteObject(userId, key);
    throw uploadTooLarge(cap);
  }

  // The object was never registered, so nothing refers to it.
  private async deleteObject(userId: string, key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete an oversized upload of user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async readObject(
    key: string,
  ): Promise<{ contentType: string | undefined; sizeBytes: number }> {
    try {
      const head = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
      return {
        contentType: head.ContentType?.split(';')[0].trim(),
        sizeBytes: Number(head.ContentLength ?? 0),
      };
    } catch (error) {
      const status = error?.$metadata?.httpStatusCode;
      if (status === 404 || error?.name === 'NotFound') {
        throw new BadRequestException('Uploaded object not found');
      }
      throw new BadGatewayException('File storage is unavailable');
    }
  }
}

// Upload keys are `uploads/<userId>/<timestamp>-<sanitized name>`.
export function originalFilename(key: string): string {
  const basename = key.slice(key.lastIndexOf('/') + 1);
  return basename.replace(/^\d+-/, '') || basename;
}
