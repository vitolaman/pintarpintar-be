// A merchant's number prefix: letters, digits, `.`, `/` and `-`, starting and
// ending with a letter or digit. `PP-CERT` is reserved for the platform's own
// numbering, so prefixed numbers never mix into its yearly sequence.
export const NUMBER_PREFIX_PATTERN =
  /^(?!pp-cert)[a-z0-9](?:[a-z0-9./-]*[a-z0-9])?$/i;

export const NUMBER_PREFIX_RULE =
  'letters, digits, ".", "/" or "-", starting and ending with a letter or digit, not starting with PP-CERT';

/**
 * The next `PREFIX-NNNN` of a class, given every number the class has used
 * (withdrawn ones included, so numbers are never reused). Only numbers that
 * are exactly the prefix, a hyphen and digits count, so `CIVIL-A-0001` does
 * not advance `CIVIL`.
 */
export function nextPrefixedNumber(
  prefix: string,
  usedNumbers: string[],
): string {
  const head = `${prefix}-`;
  let last = 0;
  for (const number of usedNumbers) {
    if (!number.startsWith(head)) continue;
    const counter = number.slice(head.length);
    if (/^[0-9]+$/.test(counter)) last = Math.max(last, Number(counter));
  }
  return `${head}${String(last + 1).padStart(4, '0')}`;
}
