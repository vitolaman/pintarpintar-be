import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  CompletedPart,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || 'default-bucket';
    
    const region = this.configService.get<string>('AWS_REGION') || 'auto';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');

    this.s3Client = new S3Client({
      region,
      endpoint: endpoint ? endpoint : undefined,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined, // fallback to standard environment/role credentials
    });
  }

  async initiateMultipartUpload(fileName: string, contentType: string) {
    const key = `uploads/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const response = await this.s3Client.send(command);
      
      return {
        uploadId: response.UploadId,
        key: response.Key,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to initiate multipart upload: ' + error.message);
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
        const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
        urls.push({
          partNumber: i,
          url: signedUrl,
        });
      }

      return urls;
    } catch (error) {
      throw new InternalServerErrorException('Failed to generate presigned URLs: ' + error.message);
    }
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]) {
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
      throw new InternalServerErrorException('Failed to complete multipart upload: ' + error.message);
    }
  }
}
