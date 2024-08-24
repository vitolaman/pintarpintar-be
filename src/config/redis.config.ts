import { registerAs } from '@nestjs/config';

export default registerAs('REDIS_CONFIG', () => {
  return {
    host: process.env.REDIS_HOST || '95.169.205.195',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  };
});
