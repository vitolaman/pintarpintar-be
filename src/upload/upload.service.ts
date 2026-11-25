import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  CompletedPart,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createObjectStorage } from '~/common/storage/object-storage';
import { buildUploadKey } from '~/common/storage/upload-key';
import { uploadContentDisposition } from './upload-disposition';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: S3Client;
  private bucketName: string;

  // The shared factory applies every AWS_* setting (AWS_S3_FORCE_PATH_STYLE
  // included), so presigned part URLs address the bucket like other features.
  constructor(private configService: ConfigService) {
    const storage = createObjectStorage(this.configService);
    this.bucketName = storage.bucket;
    this.s3Client = storage.client;
  }

  async initiateMultipartUpload(
    userId: string,
    fileName: string,
    contentType: string,
  ) {
    const key = buildUploadKey(userId, fileName);

    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
        ContentDisposition: uploadContentDisposition(contentType),
      });

      const response = await this.s3Client.send(command);

      return {
        uploadId: response.UploadId,
        key: response.Key,
      };
    } catch (error) {
      this.logger.error(
        `Failed to initiate multipart upload`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to initiate multipart upload',
      );
    }
  }

  async getPresignedUrls(key: string, uploadId: string, partsCount: number) {
    try {
      const urls = [];
      // Part numbers in S3 must be between 1 and 10000
      for (let i = 1; i <= partsCount; i++) {
        const command = new UploadPartCommand({
          Bucket: this.bucketName,
          Key: key,
          UploadId: uploadId,
          PartNumber: i,
        });

        // URL expires in 1 hour
        const signedUrl = await getSignedUrl(this.s3Client, command, {
          expiresIn: 3600,
        });
        urls.push({
          partNumber: i,
          url: signedUrl,
        });
      }

      return urls;
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URLs`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to generate presigned URLs',
      );
    }
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[],
  ) {
    try {
      // Sort parts by PartNumber to ensure correct assembly
      const sortedParts = parts.sort((a, b) => a.PartNumber - b.PartNumber);

      const command = new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sortedParts,
        },
      });

      const response = await this.s3Client.send(command);

      return {
        key: response.Key,
        location: response.Location,
        bucket: response.Bucket,
      };
    } catch (error) {
      this.logger.error(
        `Failed to complete multipart upload`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to complete multipart upload',
      );
    }
  }
}
