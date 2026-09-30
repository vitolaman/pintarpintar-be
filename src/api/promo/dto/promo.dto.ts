import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { catalogSorts, CatalogSort } from '../../catalog/dto/catalog.dto';

export const promoItemTypes = ['kelas', 'digital'] as const;

const toNumber = ({ value }: { value: unknown }) => Number(value);

export class PromoItemsQueryDto {
  @ApiPropertyOptional({
    enum: promoItemTypes,
    default: 'kelas',
    description:
      'kelas = video classes and bootcamps; digital = digital products',
  })
  @IsOptional()
  @IsIn(promoItemTypes)
  type: (typeof promoItemTypes)[number] = 'kelas';

  @ApiPropertyOptional({
    enum: catalogSorts,
    description: 'Omit for a random pick',
  })
  @IsOptional()
  @IsIn(catalogSorts)
  sort?: CatalogSort;

  @ApiPropertyOptional({ default: 6, minimum: 1, maximum: 6 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(6)
  limit = 6;
}

export class PromoVouchersQueryDto {
  @ApiPropertyOptional({ default: 6, minimum: 1, maximum: 6 })
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(6)
  limit = 6;
}
