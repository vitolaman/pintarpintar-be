import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './database/database.data-source';
import { MasterCountryModule } from './api/master-country/master-country.module';
import { RedisModule } from './common/redis/src';
import { RedisHealthIndicator } from './common/redis/src/redis-health-indicator';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './api/auth/auth.module';
import { UserModule } from './api/user/user.module';
import redisConfig from './config/redis.config';
import { APP_GUARD } from '@nestjs/core';
import { JwtGuard } from './common/guard/jwt.guard';
import { TaskModule } from './api/task/task.module';
import { LeaderboardModule } from './api/leaderboard/leaderboard.module';
import jwtConfig from './config/jwt.config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PredictionModule } from './api/prediction/prediction.module';
import { MasterPfpModule } from './api/master-pfp/master-pfp.module';
import twitterRapidapiConfig from './config/twitter-rapidapi.config';
import { User } from './api/user/entities/user.entity';
import { CronJobModule } from './api/cron-job/cron-job.module';
import { AdminModule } from './api/admin/admin.module';
import adminJwtConfig from './config/admin-jwt.config';

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
      load: [redisConfig, jwtConfig, twitterRapidapiConfig, adminJwtConfig],
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    TypeOrmModule.forFeature([User]),
    MasterCountryModule,
    RedisModule,
    AuthModule,
    UserModule,
    AdminModule,
    TaskModule,
    LeaderboardModule,
    PredictionModule,
    MasterPfpModule,
    CronJobModule,
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
