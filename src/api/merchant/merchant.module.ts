import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import { MerchantService } from './merchant.service';
import { MerchantController } from './merchant.controller';
import { MerchantMember } from './entities/merchant-member.entity';
import { MerchantProfile } from './entities/merchant-profile.entity';
import { Merchant } from './entities/merchant.entity';
import { MerchantWallet } from './entities/merchant-wallet.entity';
import { UserNotificationPreferences } from './entities/user-notification-preferences.entity';
import { ClassModule } from '../../class/class.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      MerchantWallet,
      MerchantMember,
      MerchantProfile,
      Profile,
      User,
      UserNotificationPreferences,
    ]),
    ClassModule,
  ],
  controllers: [MerchantController],
  providers: [MerchantService],
})
export class MerchantModule {}
