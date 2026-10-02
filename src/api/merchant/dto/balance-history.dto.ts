import { ApiProperty } from '@nestjs/swagger';
import { EnumInput } from '~/common/decorator/input.decorator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';

export const balanceHistoryTypes = ['income', 'withdraw'] as const;

export type BalanceHistoryType = (typeof balanceHistoryTypes)[number];

export const balanceHistoryTypeFilters = [
  'all',
  ...balanceHistoryTypes,
] as const;

export class BalanceHistoryQueryDto {
  @EnumInput(balanceHistoryTypeFilters, { presence: 'filter', default: 'all' })
  type: (typeof balanceHistoryTypeFilters)[number] = 'all';

  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;
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
