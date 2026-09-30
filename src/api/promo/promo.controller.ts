import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import { ArrayResponse } from '~/common/decorator/response.decorator';
import { CatalogCardDto } from '../catalog/dto/catalog.dto';
import { PublicVoucherResponseDto } from '../voucher/dto/voucher-response.dto';
import { PromoItemsQueryDto, PromoVouchersQueryDto } from './dto/promo.dto';
import { PromoService } from './promo.service';

@Controller('promo/v1')
@ApiTags('Promo')
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  @Get('get-promo-items')
  @Public()
  @ArrayResponse(CatalogCardDto, 'Get promo items success', [
    BadRequestException,
  ])
  findItems(@Query() query: PromoItemsQueryDto) {
    return this.promoService.findItems(query);
  }

  @Get('get-promo-vouchers')
  @Public()
  @ArrayResponse(PublicVoucherResponseDto, 'Get promo vouchers success', [
    BadRequestException,
  ])
  findVouchers(@Query() query: PromoVouchersQueryDto) {
    return this.promoService.findVouchers(query);
  }
}
