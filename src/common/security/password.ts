import { hash, verify } from '@node-rs/bcrypt';

// bcrypt cost of new hashes, as before the library change.
const PASSWORD_COST = 10;

// Hashing runs on a background thread (@node-rs/bcrypt), so concurrent
// sign-ups no longer hold up other requests on the main thread. It reads the
// $2a$ hashes stored by bcryptjs, and bcryptjs reads the hashes it writes.
export function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_COST);
}

export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return verify(password, passwordHash);
}

// bcrypt hash, at PASSWORD_COST, of a random secret that was discarded.
// Comparing a password with it takes as long as checking a real one.
export const UNUSABLE_PASSWORD_HASH =
  '$2y$10$f5/KKXL8SaOY/yucuEksnu9zjB0W0somXTD15iMQg9K5kL2aPjcIe';

// Spends one password check without a stored hash, so a sign-in for a missing
// account or an account without a password takes as long as a wrong password.
// The result is ignored: it never signs anyone in.
export async function simulatePasswordCheck(password: string): Promise<void> {
  await verify(password, UNUSABLE_PASSWORD_HASH);
}
