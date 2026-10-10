import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import {
  ArrayResponse,
  DefaultResponse,
} from '~/common/decorator/response.decorator';
import {
  ProPlanResponseDto,
  ProSubscriptionResponseDto,
} from './dto/pro-response.dto';
import {
  ProSubscribeRequestDto,
  ProSubscriptionCheckoutResponseDto,
  ProSubscriptionPreviewDto,
} from './dto/pro-subscribe.dto';
import { ProService } from './pro.service';
import { ProCheckoutService } from './pro-checkout.service';

const GATEWAY_UNAVAILABLE = new BadGatewayException(
  'Payment gateway is unavailable',
);
const GATEWAY_NOT_CONFIGURED = new ServiceUnavailableException(
  'Payment gateway is not configured',
);

@Controller('api/v1/pro-plans')
@ApiTags('Pro')
export class ProPlanController {
  constructor(private readonly proService: ProService) {}

  @Get()
  @Public()
  @ArrayResponse(ProPlanResponseDto, 'Get Pro plans success')
  findPlans() {
    return this.proService.findPlans();
  }
}

@Controller('api/v1/merchant/pro-subscription')
@ApiBearerAuth()
@ApiTags('Pro')
export class MerchantProSubscriptionController {
  constructor(private readonly proService: ProService) {}

  @Get()
  @DefaultResponse(
    ProSubscriptionResponseDto,
    'Get Pro subscription success',
    HttpStatus.OK,
    [new NotFoundException('Merchant not found')],
  )
  findSubscription(@Req() req: { user: { id: string } }) {
    return this.proService.findSubscription(req.user.id);
  }
}

@Controller('api/v1/pro-subscription')
@ApiBearerAuth()
@ApiTags('Pro')
export class ProSubscriptionController {
  constructor(private readonly checkoutService: ProCheckoutService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    ProSubscriptionPreviewDto,
    'Preview Pro subscription success',
    HttpStatus.OK,
    [NotFoundException],
  )
  async preview(
    @Req() req: { user: { id: string } },
    @Body() body: ProSubscribeRequestDto,
  ) {
    return this.checkoutService.preview(req.user.id, body.plan_id, body.code);
  }

  @Post()
  @DefaultResponse(
    ProSubscriptionCheckoutResponseDto,
    'Pro subscription checkout created',
    HttpStatus.CREATED,
    [
      NotFoundException,
      GATEWAY_UNAVAILABLE,
      GATEWAY_NOT_CONFIGURED,
    ],
  )
  async checkout(
    @Req() req: { user: { id: string } },
    @Body() body: ProSubscribeRequestDto,
  ) {
    return this.checkoutService.checkout(req.user.id, body.plan_id, body.code);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    ProSubscriptionCheckoutResponseDto,
    'Pro subscription cancelled successfully',
    HttpStatus.OK,
    [NotFoundException],
  )
  async cancel(
    @Req() req: { user: { id: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.checkoutService.cancel(req.user.id, id);
    return {
      responseMessage: 'Pro subscription cancelled successfully',
    };
  }
}
