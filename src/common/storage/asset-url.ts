// Public images are served from ASSET_PUBLIC_BASE_URL (a CDN or public bucket
// URL); without it the API returns only object keys.
export function assetUrl(
  objectKey: string | null | undefined,
  baseUrl: string | undefined = process.env.ASSET_PUBLIC_BASE_URL,
): string | null {
  if (!objectKey || !baseUrl) return null;
  const base = baseUrl.replace(/\/+$/, '');
  const key = objectKey
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${base}/${key}`;
}
