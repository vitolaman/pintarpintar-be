import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { defaultDataSource } from './database/database.data-source';
import { MasterCountryModule } from './api/master-country/master-country.module';
import { RedisModule } from './common/redis/src';
import { RedisHealthIndicator } from './common/redis/src/redis-health-indicator';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './api/user/user.module';
import redisConfig from './config/redis.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(defaultDataSource),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [redisConfig],
    }),
    MasterCountryModule,
    RedisModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [RedisHealthIndicator, AppService],
})
export class AppModule {}
