import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserMeController } from './user-me.controller';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { Referrals } from './entities/referrals.entity';
import { MonthlyReferralLeaderboard } from '../leaderboard/entities/monthly-referral-leaderboard.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { YearlyLeaderboard } from '../leaderboard/entities/yearly-prediction-leaderboard.entity';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { WeeklyPredictionLeaderboard } from '../leaderboard/entities/weekly-prediction-leaderboard.entity';
import { WeeklyLeaderboardCategory } from '../leaderboard/entities/weekly-leaderboard-category.entity';
import { MonthlyLeaderboardCategory } from '../leaderboard/entities/monthly-leaderboard-category.entity';
import { YearlyLeaderboardCategory } from '../leaderboard/entities/yearly-leaderboard-category.entity';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ADMIN_KEY'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES') },
      }),
    }),
    TypeOrmModule.forFeature([
      User,
      Referrals,
      MonthlyReferralLeaderboard,
      YearlyLeaderboard,
      WeeklyPredictionLeaderboard,
      WeeklyLeaderboardCategory,
      MonthlyLeaderboardCategory,
      YearlyLeaderboardCategory,
    ]),
  ],
  controllers: [UserMeController, UserController],
  providers: [UserService, LeaderboardService],
  exports: [UserService],
})
export class UserModule {}
