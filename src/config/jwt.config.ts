import { registerAs } from '@nestjs/config';

// Tokens must never be signed with a built-in default: a missing secret stops
// the application instead of silently using a publicly known one.
export default registerAs('jwt', () => {
  const secret = process.env.JWT_ADMIN_KEY?.trim();
  if (!secret) {
    throw new Error('JWT_ADMIN_KEY must be set to sign and verify tokens');
  }
  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES || '30d',
  };
});
