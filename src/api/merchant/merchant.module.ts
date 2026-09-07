import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import { MerchantService } from './merchant.service';
import { MerchantController } from './merchant.controller';
import { MerchantMember } from './entities/merchant-member.entity';
import { MerchantProfile } from './entities/merchant-profile.entity';
import { Merchant } from './entities/merchant.entity';
import { UserNotificationPreferences } from './entities/user-notification-preferences.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      MerchantMember,
      MerchantProfile,
      Profile,
      User,
      UserNotificationPreferences,
    ]),
  ],
  controllers: [MerchantController],
  providers: [MerchantService],
})
export class MerchantModule {}
