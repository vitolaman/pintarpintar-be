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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import {
  MerchantResponseDto,
  NotificationPreferencesResponseDto,
} from './dto/merchant-response.dto';
import { RegisterMerchantDto } from './dto/register-merchant.dto';
import { UpdateMyMerchantDto } from './dto/update-my-merchant.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { MerchantService } from './merchant.service';

@Controller('merchants/v1')
@ApiBearerAuth()
@ApiTags('Merchants')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

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

  @Get('get-my-merchant')
  @DefaultResponse(
    MerchantResponseDto,
    'Get my merchant success',
    HttpStatus.OK,
    [NotFoundException],
  )
  findMyMerchant(@Req() req: { user: { id: string } }) {
    return this.merchantService.findMyMerchant(req.user.id);
  }

  @Patch('update-my-merchant')
  @DefaultResponse(
    MerchantResponseDto,
    'Update my merchant success',
    HttpStatus.OK,
    [BadRequestException, NotFoundException],
  )
  updateMyMerchant(
    @Req() req: { user: { id: string } },
    @Body() input: UpdateMyMerchantDto,
  ) {
    return this.merchantService.updateMyMerchant(req.user.id, input);
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
}
