import { Controller } from '@nestjs/common';
import { CronJobService } from './cron-job.service';
import { Public } from '~/common/decorator/public.decorator';

@Controller('cron-job')
@Public()
export class CronJobController {
  constructor(private readonly cronJobService: CronJobService) {}

  // @Get('create-weekly-category')
  // async createWeeklyCategory() {
  //   await this.cronJobService.createWeeklyPredictionCategory();
  //   return 'Weekly category created successfully';
  // }

  // @Get('create-montly-category')
  // async createMonthlyCategory() {
  //   await this.cronJobService.createMonthlyPredictionCategory();
  //   return 'Monthly category created successfully';
  // }

  // @Get('create-yearly-category')
  // async createYearlyCategory() {
  //   await this.cronJobService.createYearlyPredictionCategory();
  //   return 'Yearly category created successfully';
  // }
}
