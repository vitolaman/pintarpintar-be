import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerException } from '@nestjs/throttler';
import {
  ArrayResponse,
  DefaultResponse,
  PaginatedResponse,
} from '~/common/decorator/response.decorator';
import {
  ClientAddressThrottlerGuard,
  TOO_MANY_REQUESTS_MESSAGE,
} from '~/common/guard/client-address-throttler.guard';
import { CheckoutService } from './checkout/checkout.service';
import {
  CheckoutPreviewResponseDto,
  CheckoutRequestDto,
  OrderDetailResponseDto,
} from './dto/checkout.dto';
import {
  RecentTransactionsQueryDto,
  TransactionResponseDto,
  TransactionsQueryDto,
} from './dto/recent-transactions.dto';
import { OrderService } from './order.service';

const ORDER_NOT_FOUND = new NotFoundException('Order not found');
const GATEWAY_UNAVAILABLE = new BadGatewayException(
  'Payment gateway is unavailable',
);
const GATEWAY_NOT_CONFIGURED = new ServiceUnavailableException(
  'Payment gateway is not configured',
);

@Controller('api/v1/orders')
@ApiBearerAuth()
@ApiTags('Orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly checkoutService: CheckoutService,
  ) {}

  @Get('recent')
  @ArrayResponse(TransactionResponseDto, 'Get recent transactions success', [
    BadRequestException,
  ])
  findRecent(
    @Req() req: { user: { id: string } },
    @Query() query: RecentTransactionsQueryDto,
  ) {
    return this.orderService.findRecent(req.user.id, query);
  }

  @Get()
  @PaginatedResponse(TransactionResponseDto, 'Get transactions success', [
    BadRequestException,
  ])
  findAll(
    @Req() req: { user: { id: string } },
    @Query() query: TransactionsQueryDto,
  ) {
    return this.orderService.findAll(req.user.id, query);
  }

  // Prices the selection with its codes for the payment summary; writes
  // nothing.
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    CheckoutPreviewResponseDto,
    'Preview checkout success',
    HttpStatus.OK,
    [BadRequestException],
  )
  preview(
    @Req() req: { user: { id: string } },
    @Body() body: CheckoutRequestDto,
  ) {
    return this.checkoutService.preview(req.user.id, body);
  }

  // Creates the pending order and its Duitku invoice (a Rp0 order is paid at
  // once, without an invoice); open `payment_reference` with Duitku's
  // `checkout.process` or redirect to `payment_url`.
  @Post()
  @DefaultResponse(
    OrderDetailResponseDto,
    'Checkout success',
    HttpStatus.CREATED,
    [
      BadRequestException,
      new ConflictException(
        'Item <item id> is awaiting payment in order <order id>',
      ),
      GATEWAY_UNAVAILABLE,
      GATEWAY_NOT_CONFIGURED,
    ],
  )
  checkout(
    @Req() req: { user: { id: string } },
    @Body() body: CheckoutRequestDto,
  ) {
    return this.checkoutService.checkout(req.user.id, body);
  }

  @Get(':id')
  @DefaultResponse(OrderDetailResponseDto, 'Get order success', HttpStatus.OK, [
    ORDER_NOT_FOUND,
  ])
  async findOne(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      data: await this.orderService.findDetail(req.user.id, id),
      responseMessage: 'Get order success',
    };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    OrderDetailResponseDto,
    'Cancel order success',
    HttpStatus.OK,
    [BadRequestException, ORDER_NOT_FOUND],
  )
  async cancel(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.checkoutService.cancel(req.user.id, id);
    return {
      data: await this.orderService.findDetail(req.user.id, id),
      responseMessage: 'Cancel order success',
    };
  }

  // Recovers a missed payment notification; rate-limited because Duitku
  // blocks callers that check too often.
  @Post(':id/check-payment')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @DefaultResponse(
    OrderDetailResponseDto,
    'Check payment success',
    HttpStatus.OK,
    [
      ORDER_NOT_FOUND,
      new ThrottlerException(TOO_MANY_REQUESTS_MESSAGE),
      GATEWAY_UNAVAILABLE,
      GATEWAY_NOT_CONFIGURED,
    ],
  )
  checkPayment(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.checkoutService.checkPayment(req.user.id, id);
  }
}
