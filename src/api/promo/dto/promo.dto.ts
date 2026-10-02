import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn } from 'class-validator';
import {
  CatalogCardType,
  catalogCardTypes,
  CatalogSortField,
  catalogSortFields,
  SORT_FIELD_DESCRIPTION,
  SORT_ORDER_DESCRIPTION,
  SortOrder,
  sortOrders,
} from '../../catalog/dto/catalog.dto';
import { PublicVoucherResponseDto } from '../../voucher/dto/voucher-response.dto';
import { canonicalValue, EnumInput } from '~/common/decorator/input.decorator';
import { LimitQuery } from '~/common/dto/request-paginated.dto';

// The promo page shows video classes and bootcamps in one section.
const DEFAULT_PROMO_TYPES: CatalogCardType[] = ['kelas', 'bootcamp'];

function parsePromoTypes(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const types = value
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean)
    .map((type) => canonicalValue(catalogCardTypes, type));
  return types.length > 0 ? types : DEFAULT_PROMO_TYPES;
}

export class PromoItemsQueryDto {
  @ApiPropertyOptional({
    type: String,
    example: 'kelas,bootcamp',
    description: `Comma-separated, ignoring case: ${catalogCardTypes.join(', ')}. Defaults to kelas,bootcamp.`,
  })
  @Transform(({ value }) => parsePromoTypes(value))
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(catalogCardTypes, { each: true })
  type: CatalogCardType[] = DEFAULT_PROMO_TYPES;

  @EnumInput(catalogSortFields, {
    presence: 'filter',
    description: `${SORT_FIELD_DESCRIPTION}. Omit for a random pick.`,
  })
  sort_by?: CatalogSortField;

  @EnumInput(sortOrders, {
    presence: 'filter',
    description: `${SORT_ORDER_DESCRIPTION}. Applies only with sort_by.`,
  })
  sort_order?: SortOrder;

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
