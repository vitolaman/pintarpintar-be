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
import twitterRapidapiConfig from './config/twitter-rapidapi.config';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'profile_pics'),
      serveRoot: '/profile-pictures',
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [redisConfig, jwtConfig, twitterRapidapiConfig],
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    MasterCountryModule,
    RedisModule,
    AuthModule,
    UserModule,
    TaskModule,
    LeaderboardModule,
    PredictionModule,
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
