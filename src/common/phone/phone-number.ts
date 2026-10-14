// Phone numbers are stored as digits with their country code, so they work
// as-is in `https://wa.me/<number>` (owner decision, 2026-10-13). Indonesian
// local forms get the 62 prefix; numbers with another country code keep it.
export const PHONE_MIN_DIGITS = 8;
export const PHONE_MAX_DIGITS = 15;
export const STORED_PHONE = new RegExp(
  `^\\d{${PHONE_MIN_DIGITS},${PHONE_MAX_DIGITS}}$`,
);

// Characters a person types around the digits.
const PHONE_CHARACTERS = /^\+?[\d\s().-]+$/;

/**
 * The stored form of a typed phone number, or null when it is not a phone
 * number (letters or other symbols, or no digits at all). The length is
 * checked by the caller.
 */
export function normalizePhone(input: string): string | null {
  const typed = input.trim();
  if (!PHONE_CHARACTERS.test(typed)) return null;
  let digits = typed.replace(/\D/g, '');
  if (!digits) return null;

  // "+…" and "00…" carry a country code.
  let international = typed.startsWith('+');
  if (!international && digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }
  if (digits.startsWith('0')) {
    digits = `62${digits.slice(1)}`;
  } else if (!international && digits.startsWith('8')) {
    digits = `62${digits}`;
  }
  // A zero typed after the country code: +62 0812…
  if (digits.startsWith('620')) digits = `62${digits.slice(3)}`;
  return digits;
}
