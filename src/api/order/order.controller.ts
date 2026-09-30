import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayResponse } from '~/common/decorator/response.decorator';
import {
  RecentTransactionsQueryDto,
  TransactionResponseDto,
} from './dto/recent-transactions.dto';
import { OrderService } from './order.service';

@Controller('orders/v1')
@ApiBearerAuth()
@ApiTags('Orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get('get-recent-transactions')
  @ArrayResponse(TransactionResponseDto, 'Get recent transactions success', [
    BadRequestException,
  ])
  findRecent(
    @Req() req: { user: { id: string } },
    @Query() query: RecentTransactionsQueryDto,
  ) {
    return this.orderService.findRecent(req.user.id, query);
  }
}
