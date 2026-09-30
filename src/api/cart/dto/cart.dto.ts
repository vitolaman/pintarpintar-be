import { ApiProperty } from '@nestjs/swagger';
import { CatalogItemDetailsDto } from '~/common/catalog/catalog-item';

export class CartEntryResponseDto {
  @ApiProperty({ description: 'Cart entry id (use it to remove)' })
  id: string;

  @ApiProperty()
  added_at: Date;

  @ApiProperty({ type: CatalogItemDetailsDto })
  item: CatalogItemDetailsDto;
}

export class CartResponseDto {
  @ApiProperty({ type: [CartEntryResponseDto] })
  items: CartEntryResponseDto[];

  @ApiProperty({
    example: 424000,
    description: 'Sum of available items live prices',
  })
  subtotal: number;

  @ApiProperty({ example: 2 })
  item_count: number;
}
