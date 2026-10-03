import { Module } from '@nestjs/common';
import { MerchantIncomeModule } from '../merchant-income/merchant-income.module';
import { MerchantLevelController } from './merchant-level.controller';
import { MerchantLevelJobsService } from './merchant-level-jobs.service';
import { MerchantLevelService } from './merchant-level.service';

@Module({
  imports: [MerchantIncomeModule],
  controllers: [MerchantLevelController],
  providers: [MerchantLevelService, MerchantLevelJobsService],
  exports: [MerchantLevelService],
})
export class MerchantLevelModule {}
