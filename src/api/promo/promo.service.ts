import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { catalogSort } from '../catalog/dto/catalog.dto';
import {
  FEATURED_VOUCHER_COUNT,
  VoucherService,
} from '../voucher/voucher.service';
import { PromoItemsQueryDto, PromoVouchersQueryDto } from './dto/promo.dto';

@Injectable()
export class PromoService {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly voucherService: VoucherService,
  ) {}

  // Promo items have both a list price and a lower discounted price.
  async findItems(query: PromoItemsQueryDto, viewerId?: string) {
    const cards = await this.catalogService.findCards(
      { types: query.type, discountedOnly: true },
      query.sort_by ? catalogSort(query.sort_by, query.sort_order) : 'random',
      query.limit,
    );
    return {
      data: await this.catalogService.withViewerFlags(viewerId, cards),
      responseMessage: 'Get promo items success',
    };
  }

  // One random draw keeps the featured strip and the voucher list disjoint
  // whenever enough vouchers exist; a short list is topped up with the
  // featured vouchers so it still shows as many as possible.
  async findVouchers(query: PromoVouchersQueryDto) {
    const picked = await this.voucherService.findRandomPublic(
      FEATURED_VOUCHER_COUNT + query.limit,
    );
    const featured = picked.slice(0, FEATURED_VOUCHER_COUNT);
    const others = picked.slice(FEATURED_VOUCHER_COUNT);
    const topUpCount = Math.max(0, query.limit - others.length);

    return {
      data: {
        featured,
        vouchers: [...others, ...featured.slice(0, topUpCount)],
      },
      responseMessage: 'Get promo vouchers success',
    };
  }
}
