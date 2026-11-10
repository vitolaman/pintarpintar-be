import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsAdmin } from '~/common/decorator/is-admin.decorator';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import {
  DailyTransactionQueryDto,
  DailyTransactionResponseDto,
} from './dto/transaction-analytics.dto';
import { TransactionAnalyticsService } from './transaction-analytics.service';

@Controller('api/v1/transaction-analytics')
@ApiBearerAuth()
@ApiTags('Transaction Analytics')
export class TransactionAnalyticsController {
  constructor(private readonly service: TransactionAnalyticsService) {}

  @Get('daily')
  @IsAdmin()
  @DefaultResponse(
    DailyTransactionResponseDto,
    'Get daily transactions success',
  )
  findDaily(@Query() query: DailyTransactionQueryDto) {
    return this.service.findDaily(query.month);
  }
}
