import { Module } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthlyReferralLeaderboard } from './entities/monthly-referral-leaderboard.entity';
import { WeeklyPredictionLeaderboard } from './entities/weekly-prediction-leaderboard.entity';
import { YearlyLeaderboard } from './entities/yearly-prediction-leaderboard.entity';
import { WeeklyLeaderboardCategory } from './entities/weekly-leaderboard-category.entity';
import { MonthlyLeaderboardCategory } from './entities/monthly-leaderboard-category.entity';
import { YearlyLeaderboardCategory } from './entities/yearly-leaderboard-category.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      WeeklyPredictionLeaderboard,
      MonthlyReferralLeaderboard,
      YearlyLeaderboard,
      WeeklyLeaderboardCategory,
      MonthlyLeaderboardCategory,
      YearlyLeaderboardCategory,
    ]),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
})
export class LeaderboardModule {}
