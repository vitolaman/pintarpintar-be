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
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
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
import { ClassService } from '../../class/class.service';
import { CreateClassDto } from '../../class/dto/create-class.dto';
import { ClassResponseDto } from '../../class/dto/class-response.dto';
import { PaginatedResponse } from '~/common/decorator/response.decorator';

@Controller('merchants/v1')
@ApiBearerAuth()
@ApiTags('Merchants')
export class MerchantController {
  constructor(
    private readonly merchantService: MerchantService,
    private readonly classService: ClassService,
  ) {}

  @Post('register')
  @DefaultResponse(
    MerchantResponseDto,
    'Register merchant success',
    HttpStatus.CREATED,
    [BadRequestException, ConflictException, NotFoundException],
  )
  register(
    @Req() req: { user: { id: string } },
    @Body() input: RegisterMerchantDto,
  ) {
    return this.merchantService.register(req.user.id, input);
  }

  @Get('get-public-merchant/:slug')
  @Public()
  @DefaultResponse(
    PublicMerchantStorefrontResponseDto,
    'Get public merchant success',
    HttpStatus.OK,
    [NotFoundException],
  )
  findPublicStorefront(@Param('slug') slug: string) {
    return this.merchantService.findPublicStorefront(slug);
  }

  @Get('get-profile')
  @DefaultResponse(
    MerchantResponseDto,
    'Get merchant profile success',
    HttpStatus.OK,
    [NotFoundException],
  )
  findProfile(@Req() req: { user: { id: string } }) {
    return this.merchantService.findMerchantProfile(req.user.id);
  }

  @Get('get-wallet')
  @DefaultResponse(
    MerchantWalletResponseDto,
    'Get merchant wallet success',
    HttpStatus.OK,
    [NotFoundException],
  )
  findWallet(@Req() req: { user: { id: string } }) {
    return this.merchantService.findWallet(req.user.id);
  }

  @Get('get-balance-history')
  @PaginatedResponse(
    BalanceHistoryItemResponseDto,
    'Get balance history success',
    [BadRequestException, NotFoundException],
  )
  findBalanceHistory(
    @Req() req: { user: { id: string } },
    @Query() query: BalanceHistoryQueryDto,
  ) {
    return this.merchantService.findBalanceHistory(req.user.id, query);
  }

  @Patch('update-profile')
  @DefaultResponse(
    MerchantResponseDto,
    'Update merchant profile success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  updateProfile(
    @Req() req: { user: { id: string } },
    @Body() input: UpdateMerchantProfileDto,
  ) {
    return this.merchantService.updateMerchantProfile(req.user.id, input);
  }

  @Get('get-notification-preferences')
  @DefaultResponse(
    NotificationPreferencesResponseDto,
    'Get notification preferences success',
    HttpStatus.OK,
    [NotFoundException],
  )
  findNotificationPreferences(@Req() req: { user: { id: string } }) {
    return this.merchantService.findNotificationPreferences(req.user.id);
  }

  @Patch('update-notification-preferences')
  @DefaultResponse(
    NotificationPreferencesResponseDto,
    'Update notification preferences success',
    HttpStatus.OK,
    [NotFoundException],
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

  @Post(':merchantId/classes')
  @DefaultResponse(ClassResponseDto, 'Create class success', HttpStatus.CREATED)
  createClass(
    @Req() req: { user: { id: string } },
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Body() dto: CreateClassDto,
  ) {
    return this.classService.createClass(req.user.id, merchantId, dto);
  }

  @Get(':merchantId/classes')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @PaginatedResponse(ClassResponseDto, 'Get classes success')
  getClasses(
    @Req() req: { user: { id: string } },
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('status') status: string,
  ) {
    return this.classService.getClassesByMerchant(
      req.user.id,
      merchantId,
      page || 1,
      limit || 10,
      status,
    );
  }
}
