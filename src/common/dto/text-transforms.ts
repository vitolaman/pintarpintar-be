// Request transforms leave non-text values untouched, so the type validators
// reject them with 400 instead of the transform throwing.

export const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Optional clearable text: null clears, blank text means "unchanged".
export const trimOptionalText = ({ value }: { value: unknown }) => {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
};
