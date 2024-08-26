import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyPredictionLeaderboard } from '../leaderboard/entities/weekly-prediction-leaderboard.entity';
import { MonthlyReferralLeaderboard } from '../leaderboard/entities/monthly-referral-leaderboard.entity';
import { YearlyLeaderboard } from '../leaderboard/entities/yearly-prediction-leaderboard.entity';
import { CronJobService } from './cron-job.service';
import { ScheduleModule } from '@nestjs/schedule';
import { dataSourceOptions } from '~/database/database.data-source';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      WeeklyPredictionLeaderboard,
      MonthlyReferralLeaderboard,
      YearlyLeaderboard,
    ]),
  ],
  controllers: [],
  providers: [CronJobService],
})
export class CronJobModule {}
