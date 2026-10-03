import { Module } from '@nestjs/common';
import { MerchantIncomeJobsService } from './merchant-income-jobs.service';
import { MerchantIncomeService } from './merchant-income.service';

@Module({
  providers: [MerchantIncomeService, MerchantIncomeJobsService],
  exports: [MerchantIncomeService],
})
export class MerchantIncomeModule {}
