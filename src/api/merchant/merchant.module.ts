import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from '../profile/entities/profile.entity';
import { User } from '../user/entities/user.entity';
import { MerchantService } from './merchant.service';
import { MerchantController } from './merchant.controller';
import { MerchantMember } from './entities/merchant-member.entity';
import { MerchantProfile } from './entities/merchant-profile.entity';
import { Merchant } from './entities/merchant.entity';
import { MerchantPayout } from './entities/merchant-payout.entity';
import { MerchantWallet } from './entities/merchant-wallet.entity';
import { MerchantWithdrawalJobsService } from './merchant-withdrawal-jobs.service';
import { MerchantWithdrawalService } from './merchant-withdrawal.service';
import { MerchantPayoutAccount } from '../payout-account/entities/merchant-payout-account.entity';
import { ClassModule } from '../../class/class.module';
import { MerchantLevelModule } from '../merchant-level/merchant-level.module';
import { NotificationPreferencesModule } from '../notification-preferences/notification-preferences.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      MerchantWallet,
      MerchantPayout,
      MerchantPayoutAccount,
      MerchantMember,
      MerchantProfile,
      Profile,
      User,
    ]),
    ClassModule,
    MerchantLevelModule,
    NotificationPreferencesModule,
  ],
  controllers: [MerchantController],
  providers: [
    MerchantService,
    MerchantWithdrawalService,
    MerchantWithdrawalJobsService,
  ],
})
export class MerchantModule {}
