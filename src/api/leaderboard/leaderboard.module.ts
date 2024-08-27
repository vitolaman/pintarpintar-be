import { Module } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthlyReferralLeaderboard } from './entities/monthly-referral-leaderboard.entity';
import { WeeklyPredictionLeaderboard } from './entities/weekly-prediction-leaderboard.entity';
import { YearlyLeaderboard } from './entities/yearly-prediction-leaderboard.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WeeklyPredictionLeaderboard,
      MonthlyReferralLeaderboard,
      YearlyLeaderboard,
    ]),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
