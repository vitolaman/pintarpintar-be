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
import {
  FileAssetResponseDto,
  RegisterUploadDto,
} from './dto/register-upload.dto';
import { createObjectStorage } from '../../common/storage/object-storage';
import {
  assertFileFitsPurpose,
  purposeVisibility,
} from './asset-purpose-rules';
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

  async registerUpload(userId: string, input: RegisterUploadDto) {
    if (!isOwnUploadKey(input.key, userId)) {
      throw new ForbiddenException('This upload belongs to another user');
    }
    const { contentType, sizeBytes } = await this.readObject(input.key);
    const filename = originalFilename(input.key);
    assertFileFitsPurpose(input.purpose, {
      filename,
      mimeType: contentType,
      sizeBytes,
    });
    const visibility = purposeVisibility(input.purpose);

    const asset = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `file-asset:${input.key}`,
      ]);
      const existing = await manager.findOne(FileAsset, {
        where: { storageProvider: STORAGE_PROVIDER, objectKey: input.key },
        withDeleted: true,
      });
      if (existing) {
        if (
          existing.uploadedByUserId !== userId ||
          existing.deleted_at ||
          existing.visibility !== visibility
        ) {
          throw new ConflictException('This upload is already registered');
        }
        return existing;
      }

      return manager.save(
        FileAsset,
        manager.create(FileAsset, {
          uploadedByUserId: userId,
          storageProvider: STORAGE_PROVIDER,
          objectKey: input.key,
          originalFilename: filename,
          mimeType: (contentType ?? 'application/octet-stream').toLowerCase(),
          sizeBytes: String(sizeBytes),
          visibility,
          status: 'active',
        }),
      );
    });

    return {
      data: this.toResponse(asset),
      responseMessage: 'Register upload success',
    };
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

  private toResponse(asset: FileAsset): FileAssetResponseDto {
    return {
      id: asset.id,
      object_key: asset.objectKey,
      original_filename: asset.originalFilename,
      mime_type: asset.mimeType,
      size_bytes: Number(asset.sizeBytes),
      visibility: asset.visibility,
    };
  }
}

// Upload keys are `uploads/<userId>/<timestamp>-<sanitized name>`.
export function originalFilename(key: string): string {
  const basename = key.slice(key.lastIndexOf('/') + 1);
  return basename.replace(/^\d+-/, '') || basename;
}
