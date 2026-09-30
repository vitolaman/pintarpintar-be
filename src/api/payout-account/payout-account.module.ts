import { Module } from '@nestjs/common';
import { PayoutAccountController } from './payout-account.controller';
import { PayoutAccountService } from './payout-account.service';

@Module({
  controllers: [PayoutAccountController],
  providers: [PayoutAccountService],
})
export class PayoutAccountModule {}
