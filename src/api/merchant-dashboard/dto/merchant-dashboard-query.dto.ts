import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { EnumInput, QueryFilter } from '~/common/decorator/input.decorator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';

export const dashboardPeriods = [7, 30, 90, 365] as const;
export const saleTypes = ['kelas', 'bootcamp', 'digital', 'bundle'] as const;
export const saleStatuses = [
  'paid',
  'pending',
  'expired',
  'failed',
  'cancelled',
] as const;
export const sortOrders = ['asc', 'desc'] as const;
const saleSorts = ['date', 'amount'] as const;
const customerSorts = ['total_spent', 'joined_at'] as const;

export type SaleType = (typeof saleTypes)[number];
export type SortOrder = (typeof sortOrders)[number];

const DEFAULT_PERIOD_DAYS = 30;

// A blank period means the default period rather than 0 days.
const toPeriodDays = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === ''
    ? DEFAULT_PERIOD_DAYS
    : Number(value);

export class DashboardQueryDto {
  @ApiPropertyOptional({ enum: dashboardPeriods, default: DEFAULT_PERIOD_DAYS })
  @IsOptional()
  @Transform(toPeriodDays)
  @IsIn(dashboardPeriods)
  period_days: (typeof dashboardPeriods)[number] = DEFAULT_PERIOD_DAYS;
}

class PagedQueryDto {
  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;

  @EnumInput(sortOrders, { presence: 'filter', default: 'desc' })
  sort_order: SortOrder = 'desc';

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'A blank value means no search',
  })
  @QueryFilter()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class SalesFilterQueryDto {
  @EnumInput(saleTypes, { presence: 'filter' })
  type?: SaleType;

  @EnumInput(saleStatuses, { presence: 'filter' })
  status?: (typeof saleStatuses)[number];

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Buyer name or item title; a blank value means no search',
  })
  @QueryFilter()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description:
      'Comma-separated item ids (class, digital product, or bundle); a blank value means every item',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : value,
  )
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  item_ids?: string[];

  @EnumInput(saleSorts, { presence: 'filter', default: 'date' })
  sort_by: (typeof saleSorts)[number] = 'date';

  @EnumInput(sortOrders, { presence: 'filter', default: 'desc' })
  sort_order: SortOrder = 'desc';
}

export class SalesQueryDto extends SalesFilterQueryDto {
  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;
}

export class CustomersQueryDto extends PagedQueryDto {
  @EnumInput(customerSorts, { presence: 'filter', default: 'total_spent' })
  sort_by: (typeof customerSorts)[number] = 'total_spent';
}
