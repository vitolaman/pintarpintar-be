import {
  BadRequestException,
  Controller,
  Get,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '~/common/decorator/public.decorator';
import {
  ArrayResponse,
  DefaultResponse,
} from '~/common/decorator/response.decorator';
import { CatalogCardDto } from '../catalog/dto/catalog.dto';
import {
  PromoItemsQueryDto,
  PromoVouchersQueryDto,
  PromoVouchersResponseDto,
} from './dto/promo.dto';
import { PromoService } from './promo.service';

@Controller('api/v1/promo')
@ApiTags('Promo')
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  @Get('items')
  @Public()
  @ArrayResponse(CatalogCardDto, 'Get promo items success', [
    BadRequestException,
  ])
  findItems(@Query() query: PromoItemsQueryDto) {
    return this.promoService.findItems(query);
  }

  @Get('vouchers')
  @Public()
  @DefaultResponse(
    PromoVouchersResponseDto,
    'Get promo vouchers success',
    HttpStatus.OK,
    [BadRequestException],
  )
  findVouchers(@Query() query: PromoVouchersQueryDto) {
    return this.promoService.findVouchers(query);
  }
}
