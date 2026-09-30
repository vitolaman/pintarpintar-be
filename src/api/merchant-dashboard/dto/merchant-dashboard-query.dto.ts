import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

export type SaleType = (typeof saleTypes)[number];
export type SortOrder = (typeof sortOrders)[number];

const toNumber = ({ value }: { value: unknown }) => Number(value);
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DashboardQueryDto {
  @ApiPropertyOptional({ enum: dashboardPeriods, default: 30 })
  @IsOptional()
  @Transform(toNumber)
  @IsIn(dashboardPeriods)
  period_days: (typeof dashboardPeriods)[number] = 30;
}

class PagedQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ enum: sortOrders, default: 'desc' })
  @IsOptional()
  @IsIn(sortOrders)
  sort_order: SortOrder = 'desc';

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class SalesFilterQueryDto {
  @ApiPropertyOptional({ enum: saleTypes })
  @IsOptional()
  @IsIn(saleTypes)
  type?: SaleType;

  @ApiPropertyOptional({ enum: saleStatuses })
  @IsOptional()
  @IsIn(saleStatuses)
  status?: (typeof saleStatuses)[number];

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Buyer name or item title',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated item ids (class, digital product, or bundle)',
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

  @ApiPropertyOptional({ enum: ['date', 'amount'], default: 'date' })
  @IsOptional()
  @IsIn(['date', 'amount'])
  sort_by: 'date' | 'amount' = 'date';

  @ApiPropertyOptional({ enum: sortOrders, default: 'desc' })
  @IsOptional()
  @IsIn(sortOrders)
  sort_order: SortOrder = 'desc';
}

export class SalesQueryDto extends SalesFilterQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class CustomersQueryDto extends PagedQueryDto {
  @ApiPropertyOptional({
    enum: ['total_spent', 'joined_at'],
    default: 'total_spent',
  })
  @IsOptional()
  @IsIn(['total_spent', 'joined_at'])
  sort_by: 'total_spent' | 'joined_at' = 'total_spent';
}
