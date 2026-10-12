import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerException } from '@nestjs/throttler';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { Public } from '~/common/decorator/public.decorator';
import {
  ClientAddressThrottlerGuard,
  TOO_MANY_REQUESTS_MESSAGE,
} from '~/common/guard/client-address-throttler.guard';
import {
  CERTIFICATE_NOT_VERIFIED,
  CertificateVerificationService,
} from './certificate-verification.service';
import { CertificateVerificationDto } from './dto/certificate-verification.dto';

@Controller('api/v1/certificates')
@ApiTags('Certificates')
export class CertificateVerificationController {
  constructor(private readonly verification: CertificateVerificationService) {}

  // Public for the certificate's QR code; rate-limited because it is a
  // lookup by code.
  @Get('verify/:code')
  @Public()
  @UseGuards(ClientAddressThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @DefaultResponse(
    CertificateVerificationDto,
    'Verify certificate success',
    HttpStatus.OK,
    [
      CERTIFICATE_NOT_VERIFIED,
      new BadRequestException('Validation failed (uuid is expected)'),
      new ThrottlerException(TOO_MANY_REQUESTS_MESSAGE),
    ],
  )
  verify(@Param('code', ParseUUIDPipe) code: string) {
    return this.verification.verify(code);
  }
}
