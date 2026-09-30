import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { VoucherService } from '../voucher/voucher.service';
import { PromoItemsQueryDto, PromoVouchersQueryDto } from './dto/promo.dto';

@Injectable()
export class PromoService {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly voucherService: VoucherService,
  ) {}

  // Promo items have both a list price and a lower discounted price.
  async findItems(query: PromoItemsQueryDto) {
    const types =
      query.type === 'digital' ? ['digital'] : ['kelas', 'bootcamp'];
    return {
      data: await this.catalogService.findCards(
        { types, discountedOnly: true },
        query.sort ?? 'random',
        query.limit,
      ),
      responseMessage: 'Get promo items success',
    };
  }

  async findVouchers(query: PromoVouchersQueryDto) {
    return {
      data: await this.voucherService.findRandomPublic(query.limit),
      responseMessage: 'Get promo vouchers success',
    };
  }
}
