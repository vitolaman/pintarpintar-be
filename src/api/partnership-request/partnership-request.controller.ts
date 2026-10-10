import {
  Body,
  Controller,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { Public } from '~/common/decorator/public.decorator';
import { ClientAddressThrottlerGuard } from '~/common/guard/client-address-throttler.guard';
import {
  CertificationPartnershipRequestResponseDto,
  CreateCertificationPartnershipRequestDto,
} from './dto/certification-partnership-request.dto';
import { PartnershipRequestService } from './partnership-request.service';

@Controller('api/v1/certification-partnership-requests')
@ApiBearerAuth()
@ApiTags('Certification Partnership Requests')
export class PartnershipRequestController {
  constructor(private readonly service: PartnershipRequestService) {}

  // Public form on /certification; linked to the user when a token is sent.
  // At most 5 submissions per visitor address per 10 minutes.
  @Post()
  @Public()
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @DefaultResponse(
    CertificationPartnershipRequestResponseDto,
    'Create certification partnership request success',
    HttpStatus.CREATED,
    [new NotFoundException('User not found')],
  )
  create(
    @Req() req: { user?: { id: string } },
    @Body() input: CreateCertificationPartnershipRequestDto,
  ) {
    return this.service.createCertificationRequest(req.user?.id ?? null, input);
  }
}
