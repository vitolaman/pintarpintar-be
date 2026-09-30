import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
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
import { assertImageWithinLimit } from './image-asset-rules';

const STORAGE_PROVIDER = 's3';

@Injectable()
export class FileAssetService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  // Mirrors the upload service configuration so both read the same bucket.
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.bucketName =
      configService.get<string>('AWS_S3_BUCKET_NAME') || 'default-bucket';
    const accessKeyId = configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const endpoint = configService.get<string>('AWS_S3_ENDPOINT');

    this.s3Client = new S3Client({
      region: configService.get<string>('AWS_REGION') || 'auto',
      endpoint: endpoint || undefined,
      forcePathStyle:
        configService.get<string>('AWS_S3_FORCE_PATH_STYLE') === 'true',
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  async registerUpload(userId: string, input: RegisterUploadDto) {
    const { contentType, sizeBytes } = await this.readObject(input.key);
    assertImageWithinLimit(input.purpose, contentType, sizeBytes);

    const asset = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `file-asset:${input.key}`,
      ]);
      const existing = await manager.findOne(FileAsset, {
        where: { storageProvider: STORAGE_PROVIDER, objectKey: input.key },
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
          objectKey: input.key,
          originalFilename: originalFilename(input.key),
          mimeType: contentType.toLowerCase(),
          sizeBytes: String(sizeBytes),
          visibility: 'public',
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

// Upload keys are `uploads/<timestamp>-<sanitized name>`.
export function originalFilename(key: string): string {
  const basename = key.slice(key.lastIndexOf('/') + 1);
  return basename.replace(/^\d+-/, '') || basename;
}
