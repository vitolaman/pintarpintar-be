import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export interface ObjectStorage {
  client: S3Client;
  bucket: string;
}

// Reads the same AWS_* settings as the upload module so every feature uses one bucket.
export function createObjectStorage(config: ConfigService): ObjectStorage {
  const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
  const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
  const endpoint = config.get<string>('AWS_S3_ENDPOINT');

  return {
    bucket: config.get<string>('AWS_S3_BUCKET_NAME') || 'default-bucket',
    client: new S3Client({
      region: config.get<string>('AWS_REGION') || 'auto',
      endpoint: endpoint || undefined,
      forcePathStyle: config.get<string>('AWS_S3_FORCE_PATH_STYLE') === 'true',
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    }),
  };
}
