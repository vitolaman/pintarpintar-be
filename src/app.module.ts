import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './api/auth/auth.module';
import { User } from './api/user/entities/user.entity';
import { UserModule } from './api/user/user.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtGuard } from './common/guard/jwt.guard';
import { RedisModule } from './common/redis/src';
import { RedisHealthIndicator } from './common/redis/src/redis-health-indicator';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import jwtConfig from './config/jwt.config';
import adminJwtConfig from './config/admin-jwt.config';
import redisConfig from './config/redis.config';
import twitterRapidapiConfig from './config/twitter-rapidapi.config';
import { dataSourceOptions } from './database/database.data-source';
import { ProfileModule } from './api/profile/profile.module';
import { HomeModule } from './api/home/home.module';
import { MerchantModule } from './api/merchant/merchant.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'profile_pics'),
      serveRoot: '/profile-pictures',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'master_profile_pics'),
      serveRoot: '/master-profile-pictures',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: process.env.ENV_FILE || '.env',
      load: [redisConfig, jwtConfig, twitterRapidapiConfig, adminJwtConfig],
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    TypeOrmModule.forFeature([User]),
    RedisModule,
    AuthModule,
    UserModule,
    ProfileModule,
    HomeModule,
    MerchantModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
    RedisHealthIndicator,
    AppService,
  ],
})
export class AppModule {}
