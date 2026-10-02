import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayResponse,
  DefaultResponse,
  EmptyResponse,
} from '~/common/decorator/response.decorator';
import { CreatePayoutAccountDto } from './dto/create-payout-account.dto';
import { PayoutAccountResponseDto } from './dto/payout-account-response.dto';
import { UpdatePayoutAccountDto } from './dto/update-payout-account.dto';
import { PayoutAccountService } from './payout-account.service';

type AuthenticatedRequest = { user: { id: string } };

@Controller('api/v1/merchant/payout-accounts')
@ApiBearerAuth()
@ApiTags('Merchant Payout Accounts')
export class PayoutAccountController {
  constructor(private readonly payoutAccountService: PayoutAccountService) {}

  @Get()
  @ArrayResponse(PayoutAccountResponseDto, 'Get payout accounts success', [
    NotFoundException,
  ])
  findAll(@Req() req: AuthenticatedRequest) {
    return this.payoutAccountService.findAll(req.user.id);
  }

  @Post()
  @DefaultResponse(
    PayoutAccountResponseDto,
    'Create payout account success',
    HttpStatus.CREATED,
    [BadRequestException, NotFoundException],
  )
  create(
    @Req() req: AuthenticatedRequest,
    @Body() input: CreatePayoutAccountDto,
  ) {
    return this.payoutAccountService.create(req.user.id, input);
  }

  @Patch(':id')
  @DefaultResponse(
    PayoutAccountResponseDto,
    'Update payout account success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdatePayoutAccountDto,
  ) {
    return this.payoutAccountService.update(req.user.id, id, input);
  }

  @Post(':id/set-primary')
  @HttpCode(HttpStatus.OK)
  @DefaultResponse(
    PayoutAccountResponseDto,
    'Set primary payout account success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  setPrimary(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payoutAccountService.setPrimary(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([BadRequestException, NotFoundException])
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payoutAccountService.remove(req.user.id, id);
  }
}
