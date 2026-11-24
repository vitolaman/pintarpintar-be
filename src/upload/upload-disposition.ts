const INLINE_TYPE_PREFIXES = ['image/', 'video/', 'audio/'];
const INLINE_TYPES = new Set(['application/pdf']);
const SCRIPTABLE_IMAGE_TYPES = new Set(['image/svg+xml']);

/**
 * Public uploads are served from cdn.pintarpintar.id, so a file that a
 * browser renders as a page (HTML, SVG, XML, ...) would run on the project's
 * domain. Only media and PDF stay inline; everything else is stored with
 * `Content-Disposition: attachment` so every link downloads it. The decision
 * is made when the upload starts because the object's headers are fixed then.
 */
export function uploadContentDisposition(
  contentType: string,
): 'attachment' | undefined {
  const mediaType = contentType.split(';')[0].trim().toLowerCase();
  if (SCRIPTABLE_IMAGE_TYPES.has(mediaType)) return 'attachment';
  if (INLINE_TYPES.has(mediaType)) return undefined;
  if (INLINE_TYPE_PREFIXES.some((prefix) => mediaType.startsWith(prefix))) {
    return undefined;
  }
  return 'attachment';
}
