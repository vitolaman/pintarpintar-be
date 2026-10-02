import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '~/common/decorator/public.decorator';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { ClientAddressThrottlerGuard } from '~/common/guard/client-address-throttler.guard';
import {
  TrackVisitDto,
  TrackVisitResponseDto,
} from './dto/merchant-analytics.dto';
import { VisitTrackingService } from './visit-tracking.service';

@Controller('api/v1/analytics')
@ApiTags('Analytics')
export class VisitTrackingController {
  constructor(private readonly visitTrackingService: VisitTrackingService) {}

  // Public; a sent login token makes the user the visitor. Called by the
  // storefront and the class, bootcamp and digital product detail pages.
  @Post('visits')
  @Public()
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    TrackVisitResponseDto,
    'Track visit success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  track(
    @Req() req: { user?: { id: string } },
    @Headers('user-agent') userAgent: string | undefined,
    @Body() input: TrackVisitDto,
  ) {
    return this.visitTrackingService.track(
      input,
      req.user?.id ?? null,
      userAgent,
    );
  }
}
