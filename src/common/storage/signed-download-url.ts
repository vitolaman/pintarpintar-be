import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ObjectStorage } from './object-storage';

// Private objects (mentor documents, paid class and product files) are never
// exposed as permanent URLs; readers with access get a short-lived link.
export const DOWNLOAD_URL_TTL_SECONDS = 600;

export function signedDownloadUrl(
  storage: ObjectStorage,
  objectKey: string,
  filename: string,
): Promise<string> {
  const safeName = filename.replace(/["\\\r\n]/g, '_');
  return getSignedUrl(
    storage.client,
    new GetObjectCommand({
      Bucket: storage.bucket,
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
}
