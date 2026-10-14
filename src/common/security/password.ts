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
