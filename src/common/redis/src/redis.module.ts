import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import { CacheModule, CacheModuleAsyncOptions } from '@nestjs/cache-manager';

export const redisOptions: CacheModuleAsyncOptions = {
  isGlobal: true,
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => {
    const cfg = configService.get('REDIS_CONFIG');

    const store = await redisStore({
      socket: {
        host: cfg.host,
        port: cfg.port,
      },
      password: cfg.password,
    });
    return {
      store: () => store,
    };
  },
  inject: [ConfigService],
};

@Module({
  imports: [CacheModule.registerAsync<CacheModuleAsyncOptions>(redisOptions)],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
