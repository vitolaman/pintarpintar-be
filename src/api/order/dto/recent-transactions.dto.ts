import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';
import { catalogItemTypes } from '~/common/catalog/catalog-item';
import { EnumInput } from '~/common/decorator/input.decorator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';

export class RecentTransactionsQueryDto {
  @LimitQuery({
    defaultLimit: 3,
    maxLimit: 20,
    description: 'Number of recent transactions.',
  })
  limit = 3;
}

export class TransactionsQueryDto {
  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;

  @EnumInput(Object.values(OrderStatus), {
    presence: 'filter',
    description:
      'Filters by the status as returned: an unpaid order past its expiry counts as `expired`',
  })
  status?: OrderStatus;
}

export class TransactionItemResponseDto {
  @ApiProperty({ enum: catalogItemTypes })
  type: string;

  @ApiProperty()
  item_id: string;

  @ApiProperty({ example: 'Belajar AutoCAD dari Nol' })
  title: string;

  @ApiProperty({
    nullable: true,
    description: 'Public cover URL (null without a cover)',
  })
  image_url: string | null;

  @ApiProperty({ nullable: true, example: 'Akademi Teknik Budi' })
  merchant_name: string | null;

  @ApiProperty({ example: 299000, description: 'Selling price before codes' })
  price: number;
}

export class TransactionResponseDto {
  @ApiProperty({ description: 'Order id' })
  id: string;

  @ApiProperty({ example: 'ORD-20260930-0001' })
  order_number: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({
    enum: OrderStatus,
    description: 'An unpaid order past its expiry reads as `expired`',
  })
  status: string;

  @ApiProperty({ example: 299000 })
  total_amount: number;

  @ApiProperty({ example: 0 })
  discount_amount: number;

  @ApiProperty({ type: [TransactionItemResponseDto] })
  items: TransactionItemResponseDto[];
}
