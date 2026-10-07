import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Req,
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
import { ProService } from './pro.service';

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
