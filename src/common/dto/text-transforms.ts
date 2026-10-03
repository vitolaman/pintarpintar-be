// Request transforms leave non-text values untouched, so the type validators
// reject them with 400 instead of the transform throwing.

export const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
