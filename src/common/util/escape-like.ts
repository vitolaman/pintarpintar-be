// Escapes LIKE wildcards so user search text matches literally (backslash is
// PostgreSQL's default LIKE escape character).
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
