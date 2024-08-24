import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserMeController } from './user-me.controller';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { Referrals } from './entities/referrals.entity';
import { MonthlyReferralLeaderboard } from '../leaderboard/entities/monthly-referral-leaderboard.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Referrals, MonthlyReferralLeaderboard]),
  ],
  controllers: [UserMeController, UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
