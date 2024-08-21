import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { defaultDataSource } from './database/database.data-source';
import { MasterCountryModule } from './api/master-country/master-country.module';
import { RedisModule } from './common/redis/src';
import { RedisHealthIndicator } from './common/redis/src/redis-health-indicator';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './api/auth/auth.module';
import { UserModule } from './api/user/user.module';
import redisConfig from './config/redis.config';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [redisConfig],
    }),
    TypeOrmModule.forRoot(defaultDataSource),
    MasterCountryModule,
    RedisModule,
    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [RedisHealthIndicator, AppService],
})
export class AppModule {}
