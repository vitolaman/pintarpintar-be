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
    TypeOrmModule.forFeature([User, Referrals, MonthlyReferralLeaderboard]),
  ],
  controllers: [UserMeController, UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
