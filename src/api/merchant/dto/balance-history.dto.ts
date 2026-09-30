import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const balanceHistoryTypes = ['income', 'withdraw'] as const;

export type BalanceHistoryType = (typeof balanceHistoryTypes)[number];

export const balanceHistoryTypeFilters = [
  'all',
  ...balanceHistoryTypes,
] as const;

export class BalanceHistoryQueryDto {
  @ApiPropertyOptional({ enum: balanceHistoryTypeFilters, default: 'all' })
  @IsOptional()
  @IsIn(balanceHistoryTypeFilters)
  type: (typeof balanceHistoryTypeFilters)[number] = 'all';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class BalanceHistoryItemResponseDto {
  @ApiProperty({
    description: 'Order item id (income) or payout id (withdraw)',
  })
  id: string;

  @ApiProperty({ enum: balanceHistoryTypes })
  type: BalanceHistoryType;

  @ApiProperty({ example: 299000 })
  amount: number;

  @ApiProperty({
    example: 'Penjualan Belajar AutoCAD dari Nol',
    description: 'Sale title for income, destination account for withdraw',
  })
  description: string;

  @ApiProperty()
  occurred_at: Date;

  @ApiProperty({
    example: 'success',
    description:
      'Income is always success; withdraw uses the payout status (pending, processing, success, failed)',
  })
  status: string;
}
