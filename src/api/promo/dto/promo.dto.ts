import { ApiProperty } from '@nestjs/swagger';
import { catalogSorts, CatalogSort } from '../../catalog/dto/catalog.dto';
import { PublicVoucherResponseDto } from '../../voucher/dto/voucher-response.dto';
import { EnumInput } from '~/common/decorator/input.decorator';
import { LimitQuery } from '~/common/dto/request-paginated.dto';

export const promoItemTypes = ['kelas', 'digital'] as const;

export class PromoItemsQueryDto {
  // a blank type means the default tab.
  @EnumInput(promoItemTypes, {
    presence: 'filter',
    default: 'kelas',
    description:
      'kelas = video classes and bootcamps; digital = digital products',
  })
  type: (typeof promoItemTypes)[number] = 'kelas';

  @EnumInput(catalogSorts, {
    presence: 'filter',
    description: 'Omit, or send a blank value, for a random pick',
  })
  sort?: CatalogSort;

  @LimitQuery({
    defaultLimit: 6,
    maxLimit: 6,
    description: 'Number of items.',
  })
  limit = 6;
}

export class PromoVouchersQueryDto {
  @LimitQuery({
    defaultLimit: 6,
    maxLimit: 6,
    description: 'Size of the voucher list below the featured strip.',
  })
  limit = 6;
}

export class PromoVouchersResponseDto {
  @ApiProperty({
    type: [PublicVoucherResponseDto],
    description: 'Featured strip: up to 3 random vouchers',
  })
  featured: PublicVoucherResponseDto[];

  @ApiProperty({
    type: [PublicVoucherResponseDto],
    description:
      'Voucher list: up to `limit` random vouchers not in `featured`, topped up from `featured` only when too few vouchers exist',
  })
  vouchers: PublicVoucherResponseDto[];
}
