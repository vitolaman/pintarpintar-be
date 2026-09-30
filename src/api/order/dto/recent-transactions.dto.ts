import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
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
