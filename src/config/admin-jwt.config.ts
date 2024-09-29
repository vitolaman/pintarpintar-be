import { registerAs } from '@nestjs/config';

export default registerAs('admin-jwt', () => ({
  secret: process.env.ADMIN_JWT_ADMIN_KEY || 'super-secret-key',
}));
