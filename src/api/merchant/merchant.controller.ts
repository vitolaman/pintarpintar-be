import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Patch,
  Post,
  Req,
  Query,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { Public } from '~/common/decorator/public.decorator';
import {
  MerchantResponseDto,
  NotificationPreferencesResponseDto,
} from './dto/merchant-response.dto';
import {
  BalanceHistoryItemResponseDto,
  BalanceHistoryQueryDto,
} from './dto/balance-history.dto';
import { MerchantWalletResponseDto } from './dto/merchant-wallet-response.dto';
import { PublicMerchantStorefrontResponseDto } from './dto/public-merchant-storefront-response.dto';
import { RegisterMerchantDto } from './dto/register-merchant.dto';
import { UpdateMerchantProfileDto } from './dto/update-merchant-profile.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { MerchantService } from './merchant.service';
import { MerchantWithdrawalService } from './merchant-withdrawal.service';
import {
  RequestWithdrawalDto,
  WithdrawalResponseDto,
} from './dto/withdrawal.dto';
import { ClassService } from '../../class/class.service';
import { ClassListQueryDto } from '../../class/dto/class-list-query.dto';
import { CreateClassDto } from '../../class/dto/create-class.dto';
import { ClassResponseDto } from '../../class/dto/class-response.dto';
import { PaginatedResponse } from '~/common/decorator/response.decorator';

const MERCHANT_NOT_FOUND = new NotFoundException('Merchant not found');
const WALLET_NOT_FOUND = new NotFoundException('Merchant wallet not found');

@Controller('api/v1')
@ApiBearerAuth()
@ApiTags('Merchants')
export class MerchantController {
  constructor(
    private readonly merchantService: MerchantService,
    private readonly classService: ClassService,
    private readonly withdrawals: MerchantWithdrawalService,
  ) {}

  @Post('merchant/register')
  @DefaultResponse(
    MerchantResponseDto,
    'Register merchant success',
    HttpStatus.CREATED,
    [
      BadRequestException,
      new ConflictException('User already owns a merchant'),
      new NotFoundException('User not found'),
    ],
  )
  register(
    @Req() req: { user: { id: string } },
    @Body() input: RegisterMerchantDto,
  ) {
    return this.merchantService.register(req.user.id, input);
  }

  @Get('merchants/:merchant')
  @Public()
  @ApiParam({
    name: 'merchant',
    description: 'Merchant id (used by the frontend) or store slug',
  })
  @DefaultResponse(
    PublicMerchantStorefrontResponseDto,
    'Get public merchant success',
    HttpStatus.OK,
    [MERCHANT_NOT_FOUND],
  )
  findPublicStorefront(
    @Req() req: { user?: { id: string } },
    @Param('merchant') merchant: string,
  ) {
    return this.merchantService.findPublicStorefront(merchant, req.user?.id);
  }

  @Get('merchant/profile')
  @DefaultResponse(
    MerchantResponseDto,
    'Get merchant profile success',
    HttpStatus.OK,
    [MERCHANT_NOT_FOUND],
  )
  findProfile(@Req() req: { user: { id: string } }) {
    return this.merchantService.findMerchantProfile(req.user.id);
  }

  @Get('merchant/wallet')
  @DefaultResponse(
    MerchantWalletResponseDto,
    'Get merchant wallet success',
    HttpStatus.OK,
    [MERCHANT_NOT_FOUND, WALLET_NOT_FOUND],
  )
  findWallet(@Req() req: { user: { id: string } }) {
    return this.merchantService.findWallet(req.user.id);
  }

  // "Tarik Saldo": minimum Rp100.000, Rp5.000 fee, processed manually.
  @Post('merchant/withdrawals')
  @DefaultResponse(
    WithdrawalResponseDto,
    'Request withdrawal success',
    HttpStatus.CREATED,
    [
      BadRequestException,
      MERCHANT_NOT_FOUND,
      WALLET_NOT_FOUND,
      new NotFoundException('Payout account not found'),
    ],
  )
  requestWithdrawal(
    @Req() req: { user: { id: string } },
    @Body() body: RequestWithdrawalDto,
  ) {
    return this.withdrawals.request(req.user.id, body);
  }

  @Get('merchant/balance-history')
  @PaginatedResponse(
    BalanceHistoryItemResponseDto,
    'Get balance history success',
    [BadRequestException, MERCHANT_NOT_FOUND],
  )
  findBalanceHistory(
    @Req() req: { user: { id: string } },
    @Query() query: BalanceHistoryQueryDto,
  ) {
    return this.merchantService.findBalanceHistory(req.user.id, query);
  }

  @Patch('merchant/profile')
  @DefaultResponse(
    MerchantResponseDto,
    'Update merchant profile success',
    HttpStatus.OK,
    [BadRequestException, MERCHANT_NOT_FOUND],
  )
  updateProfile(
    @Req() req: { user: { id: string } },
    @Body() input: UpdateMerchantProfileDto,
  ) {
    return this.merchantService.updateMerchantProfile(req.user.id, input);
  }

  @Get('merchant/notification-preferences')
  @DefaultResponse(
    NotificationPreferencesResponseDto,
    'Get notification preferences success',
    HttpStatus.OK,
    [MERCHANT_NOT_FOUND],
  )
  findNotificationPreferences(@Req() req: { user: { id: string } }) {
    return this.merchantService.findNotificationPreferences(req.user.id);
  }

  @Patch('merchant/notification-preferences')
  @DefaultResponse(
    NotificationPreferencesResponseDto,
    'Update notification preferences success',
    HttpStatus.OK,
    [MERCHANT_NOT_FOUND],
  )
  updateNotificationPreferences(
    @Req() req: { user: { id: string } },
    @Body() input: UpdateNotificationPreferencesDto,
  ) {
    return this.merchantService.updateNotificationPreferences(
      req.user.id,
      input,
    );
  }

  @Post('merchant/classes')
  @DefaultResponse(
    ClassResponseDto,
    'Create class success',
    HttpStatus.CREATED,
    [MERCHANT_NOT_FOUND],
  )
  async createClass(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateClassDto,
  ) {
    const merchantId = await this.merchantService.findOwnMerchantId(
      req.user.id,
    );
    return this.classService.createClass(req.user.id, merchantId, dto);
  }

  @Get('merchant/classes')
  @PaginatedResponse(ClassResponseDto, 'Get classes success', [
    MERCHANT_NOT_FOUND,
  ])
  async getClasses(
    @Req() req: { user: { id: string } },
    @Query() query: ClassListQueryDto,
  ) {
    const merchantId = await this.merchantService.findOwnMerchantId(
      req.user.id,
    );
    return this.classService.getClassesByMerchant(
      req.user.id,
      merchantId,
      query,
    );
  }
}
