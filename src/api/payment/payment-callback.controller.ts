import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConsumes,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import { DuitkuCallbackDto } from './dto/duitku-callback.dto';
import { DuitkuClient } from './duitku/duitku.client';
import { isValidCallbackSignature } from './duitku/duitku-signature';
import { OrderPaymentService } from './order-payment.service';

@Controller('payments/v1')
@ApiTags('Payments')
export class PaymentCallbackController {
  constructor(
    private readonly duitku: DuitkuClient,
    private readonly payments: OrderPaymentService,
  ) {}

  /**
   * Duitku's payment notification: the only source that marks an order paid.
   * Duitku retries until it receives 200, so a repeat is acknowledged
   * without applying anything twice.
   */
  @Public()
  @Post('duitku-callback')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiOkResponse({ description: 'Notification processed' })
  @ApiBadRequestResponse({
    description: 'Invalid signature, unknown order, or amount mismatch',
  })
  @ApiServiceUnavailableResponse({
    description: 'Payment gateway is not configured',
  })
  async handleDuitkuCallback(@Body() callback: DuitkuCallbackDto) {
    const { merchantCode, apiKey } = this.duitku.requireConfig();
    if (
      callback.merchantCode !== merchantCode ||
      !isValidCallbackSignature(callback, callback.signature, apiKey)
    ) {
      throw new BadRequestException('Invalid callback signature');
    }

    try {
      await this.payments.applyGatewayResult({
        orderNumber: callback.merchantOrderId,
        resultCode: callback.resultCode,
        amount: callback.amount,
        reference: callback.reference ?? null,
        paymentMethod: callback.paymentCode ?? null,
        settlementDate: callback.settlementDate ?? null,
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException('Unknown order');
      }
      throw error;
    }
    return { responseMessage: 'Callback processed' };
  }
}
