import { UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { createObjectStorage } from '~/common/storage/object-storage';
import { UploadService } from './upload.service';

const KEY = 'uploads/30000000-0000-4000-8000-000000000001/1-modul.pdf';

function settings(extra: Record<string, string> = {}): ConfigService {
  return new ConfigService({
    AWS_S3_BUCKET_NAME: 'pp-bucket',
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'id',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_S3_ENDPOINT: 'https://storage.example.test',
    ...extra,
  });
}

// Presigning is local, so the real URL shape is checked without a network.
async function uploadPartUrl(config: ConfigService): Promise<URL> {
  const [part] = await new UploadService(config).getPresignedUrls(
    KEY,
    'upload-1',
    1,
  );
  return new URL(part.url);
}

async function sharedPartUrl(config: ConfigService): Promise<URL> {
  const storage = createObjectStorage(config);
  return new URL(
    await getSignedUrl(
      storage.client,
      new UploadPartCommand({
        Bucket: storage.bucket,
        Key: KEY,
        UploadId: 'upload-1',
        PartNumber: 1,
      }),
    ),
  );
}

describe('UploadService storage client', () => {
  it('addresses the bucket by path when AWS_S3_FORCE_PATH_STYLE is true', async () => {
    const url = await uploadPartUrl(
      settings({ AWS_S3_FORCE_PATH_STYLE: 'true' }),
    );

    expect(url.host).toBe('storage.example.test');
    expect(url.pathname).toBe(`/pp-bucket/${KEY}`);
  });

  it('keeps the bucket host when the setting is unset', async () => {
    const url = await uploadPartUrl(settings());

    expect(url.host).toBe('pp-bucket.storage.example.test');
    expect(url.pathname).toBe(`/${KEY}`);
  });

  it.each([{}, { AWS_S3_FORCE_PATH_STYLE: 'true' }])(
    'presigns the same bucket address as the shared client (%p)',
    async (extra) => {
      const upload = await uploadPartUrl(settings(extra));
      const shared = await sharedPartUrl(settings(extra));

      expect(`${upload.origin}${upload.pathname}`).toBe(
        `${shared.origin}${shared.pathname}`,
      );
    },
  );
});
