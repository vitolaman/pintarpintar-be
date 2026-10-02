import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DataSource } from 'typeorm';
import { FileAsset } from '../profile/entities/file-asset.entity';
import { createObjectStorage } from '../../common/storage/object-storage';
import { PENDING_VISIBILITY } from './asset-purpose-rules';
import { isOwnUploadKey } from '~/common/storage/upload-key';

const STORAGE_PROVIDER = 's3';

@Injectable()
export class FileAssetService {
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
   * Registers a completed upload of the caller as a pending file asset. The
   * first form field it is attached to decides whether it is public or
   * private (see `assertOwnedAsset`). Registering the same key again returns
   * the caller's existing asset.
   */
  async registerCompleted(userId: string, key: string): Promise<FileAsset> {
    if (!isOwnUploadKey(key, userId)) {
      throw new ForbiddenException('This upload belongs to another user');
    }
    const { contentType, sizeBytes } = await this.readObject(key);

    return this.dataSource.transaction(async (manager) => {
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
