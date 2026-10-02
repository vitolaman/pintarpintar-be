import { Module } from '@nestjs/common';
import { MerchantLevelController } from './merchant-level.controller';
import { MerchantLevelJobsService } from './merchant-level-jobs.service';
import { MerchantLevelService } from './merchant-level.service';

@Module({
  controllers: [MerchantLevelController],
  providers: [MerchantLevelService, MerchantLevelJobsService],
  exports: [MerchantLevelService],
})
export class MerchantLevelModule {}
