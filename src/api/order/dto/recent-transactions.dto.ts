import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrderStatus } from '../entities/order.entity';
import { catalogItemTypes } from '~/common/catalog/catalog-item';

export class RecentTransactionsQueryDto {
  @ApiPropertyOptional({ default: 3, minimum: 1, maximum: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 3;
}

export class TransactionsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class TransactionItemResponseDto {
  @ApiProperty({ enum: catalogItemTypes })
  type: string;

  @ApiProperty()
  item_id: string;

  @ApiProperty({ example: 'Belajar AutoCAD dari Nol' })
  title: string;

  @ApiProperty({ example: 299000 })
  price: number;
}

export class TransactionResponseDto {
  @ApiProperty({ description: 'Order id' })
  id: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ enum: ['paid', 'pending'] })
  status: string;

  @ApiProperty({ example: 299000 })
  total_amount: number;

  @ApiProperty({ example: 0 })
  discount_amount: number;

  @ApiProperty({ type: [TransactionItemResponseDto] })
  items: TransactionItemResponseDto[];
}
