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
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Public } from '~/common/decorator/public.decorator';
import { DuitkuCallbackDto } from './dto/duitku-callback.dto';
import { DuitkuClient } from './duitku/duitku.client';
import { isValidCallbackSignature } from './duitku/duitku-signature';
import { OrderPaymentService } from './order-payment.service';
import { ProPaymentService } from './pro-payment.service';

@Controller('api/v1/payments')
@ApiTags('Payments')
export class PaymentCallbackController {
  constructor(
    private readonly duitku: DuitkuClient,
    private readonly orderPayments: OrderPaymentService,
    private readonly proPayments: ProPaymentService,
  ) {}

  /**
   * Duitku's payment notification for both orders and Pro subscriptions.
   * Differentiates based on the merchant order ID prefix (ORD- vs PRO-).
   * Duitku retries until it receives 200, so a repeat is acknowledged without
   * applying anything twice.
   */
  @Public()
  @Post('duitku/callback')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiOkResponse({
    description: 'Notification processed',
    schema: {
      type: 'object',
      properties: {
        responseMessage: { type: 'string', example: 'Callback processed' },
      },
      required: ['responseMessage'],
    },
  })
  @ApiBadRequestResponse({
    description:
      'Missing or invalid fields, invalid signature or merchant code, unknown order, or amount mismatch',
  })
  @ApiServiceUnavailableResponse({
    description: 'Payment gateway is not configured',
  })
  @ApiBody({ type: DuitkuCallbackDto })
  async handleDuitkuCallback(@Body() body: Record<string, unknown>) {
    const callback = await parseDuitkuCallback(body);
    const { merchantCode, apiKey } = this.duitku.requireConfig();
    if (
      callback.merchantCode !== merchantCode ||
      !isValidCallbackSignature(callback, callback.signature, apiKey)
    ) {
      throw new BadRequestException('Invalid callback signature');
    }

    try {
      const result = {
        resultCode: callback.resultCode,
        amount: callback.amount,
        reference: callback.reference ?? null,
        paymentMethod: callback.paymentCode ?? null,
        settlementDate: callback.settlementDate ?? null,
      };

      // Route to appropriate payment service based on order ID prefix
      if (callback.merchantOrderId.startsWith('PRO-')) {
        await this.proPayments.applyGatewayResult({
          transactionNumber: callback.merchantOrderId,
          ...result,
        });
      } else if (callback.merchantOrderId.startsWith('ORD-')) {
        await this.orderPayments.applyGatewayResult({
          orderNumber: callback.merchantOrderId,
          ...result,
        });
      } else {
        throw new BadRequestException('Unknown merchant order ID format');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException('Unknown order or transaction');
      }
      throw error;
    }
    return { responseMessage: 'Callback processed' };
  }
}

// Duitku is an external contract: its notification carries fields this API
// does not use (productDetail, merchantUserId, spUserHash, ...), so the body is
// typed without the global unknown-field rejection, which would answer every
// real notification with 400. The fields that are used are still validated.
async function parseDuitkuCallback(
  body: Record<string, unknown>,
): Promise<DuitkuCallbackDto> {
  const callback = plainToInstance(DuitkuCallbackDto, body ?? {});
  const errors = await validate(callback, { whitelist: true });
  if (errors.length > 0) {
    throw new BadRequestException(
      errors.flatMap((error) => Object.values(error.constraints ?? {})),
    );
  }
  return callback;
}
