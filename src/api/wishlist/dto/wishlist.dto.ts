import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CatalogItemDetailsDto } from '~/common/catalog/catalog-item';

export class WishlistQueryDto {
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

export class WishlistEntryResponseDto {
  @ApiProperty({ description: 'Wishlist entry id (use it to remove)' })
  id: string;

  @ApiProperty()
  added_at: Date;

  @ApiProperty({ type: CatalogItemDetailsDto })
  item: CatalogItemDetailsDto;
}
