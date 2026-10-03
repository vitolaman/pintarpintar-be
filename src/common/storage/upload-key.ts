// Upload object keys carry the uploader's id: `uploads/<userId>/<time>-<name>`.
// Every later step checks the prefix, so one user cannot presign or complete
// (and so register) another user's upload.

export function uploadKeyPrefix(userId: string): string {
  return `uploads/${userId}/`;
}

export function buildUploadKey(
  userId: string,
  fileName: string,
  now = Date.now(),
): string {
  return `${uploadKeyPrefix(userId)}${now}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
}

export function isOwnUploadKey(key: string, userId: string): boolean {
  const prefix = uploadKeyPrefix(userId);
  return key.startsWith(prefix) && !key.slice(prefix.length).includes('/');
}
