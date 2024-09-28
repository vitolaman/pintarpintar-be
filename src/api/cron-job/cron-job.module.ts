import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronJobService } from './cron-job.service';
import { ScheduleModule } from '@nestjs/schedule';
import { dataSourceOptions } from '~/database/database.data-source';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Predictions } from '../prediction/entities/prediction.entity';
import { CronJobController } from './cron-job.controller';
import { WeeklyLeaderboardCategory } from '../leaderboard/entities/weekly-leaderboard-category.entity';
import { MonthlyLeaderboardCategory } from '../leaderboard/entities/monthly-leaderboard-category.entity';
import { YearlyLeaderboardCategory } from '../leaderboard/entities/yearly-leaderboard-category.entity';
import { User } from '../user/entities/user.entity';
import { WeeklyPredictionLeaderboard } from '../leaderboard/entities/weekly-prediction-leaderboard.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    HttpModule.registerAsync({
      imports: [ConfigModule.forRoot()],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          baseURL: `${config.get<string>('API_BASE_URL')}`,
        };
      },
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      WeeklyLeaderboardCategory,
      MonthlyLeaderboardCategory,
      YearlyLeaderboardCategory,
      Predictions,
      User,
      WeeklyPredictionLeaderboard,
    ]),
  ],
  controllers: [CronJobController],
  providers: [CronJobService],
})
export class CronJobModule {}
