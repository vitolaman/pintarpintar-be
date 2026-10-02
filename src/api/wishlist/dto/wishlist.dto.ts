import { ApiProperty } from '@nestjs/swagger';
import { CatalogItemDetailsDto } from '~/common/catalog/catalog-item';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';

export class WishlistQueryDto {
  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;
}

export class WishlistEntryResponseDto {
  @ApiProperty({ description: 'Wishlist entry id (use it to remove)' })
  id: string;

  @ApiProperty()
  added_at: Date;

  @ApiProperty({ type: CatalogItemDetailsDto })
  item: CatalogItemDetailsDto;
}
