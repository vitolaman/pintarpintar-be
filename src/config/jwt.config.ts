import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_ADMIN_KEY || 'super-secret-key',
  expiresIn: process.env.JWT_EXPIRES || '30d',
}));
