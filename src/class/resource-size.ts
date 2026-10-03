// `file_resources.size` stores a byte count as text; the API reports it as a
// number of bytes. A missing or unreadable value means the size is unknown.
export function resourceSizeBytes(
  size: string | number | null | undefined,
): number | null {
  if (size === null || size === undefined) return null;
  if (typeof size === 'string' && size.trim() === '') return null;
  const bytes = Number(size);
  return Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null;
}
