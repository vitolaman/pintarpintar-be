import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ObjectStorage } from './object-storage';

// Private objects (mentor documents, paid class and product files) are never
// exposed as permanent URLs; readers with access get a short-lived link.
export const DOWNLOAD_URL_TTL_SECONDS = 600;

// A video player fetches the file in pieces while it plays and on every seek,
// and each piece re-checks the link, so playback links last long enough for a
// long recording or a tab left open (owner decision 2026-11-06). A reload, or
// the client refetching the class, issues a fresh link.
export const VIDEO_URL_TTL_SECONDS = 6 * 60 * 60;

export function signedDownloadUrl(
  storage: ObjectStorage,
  objectKey: string,
  filename: string,
  expiresIn: number = DOWNLOAD_URL_TTL_SECONDS,
): Promise<string> {
  const safeName = filename.replace(/["\\\r\n]/g, '_');
  return getSignedUrl(
    storage.client,
    new GetObjectCommand({
      Bucket: storage.bucket,
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
    }),
    { expiresIn },
  );
}

/** A signed link that plays a class video, valid for VIDEO_URL_TTL_SECONDS. */
export function signedVideoUrl(
  storage: ObjectStorage,
  objectKey: string,
  filename: string,
): Promise<string> {
  return signedDownloadUrl(storage, objectKey, filename, VIDEO_URL_TTL_SECONDS);
}
