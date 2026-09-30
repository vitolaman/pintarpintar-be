import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const portalItemTypes = [
  'kelas-video',
  'live-bootcamp',
  'produk-digital',
] as const;

export type PortalItemType = (typeof portalItemTypes)[number];

export const portalItemTypeFilters = ['all', ...portalItemTypes] as const;

export type PortalItemTypeFilter = (typeof portalItemTypeFilters)[number];

export class PortalItemQueryDto {
  @ApiPropertyOptional({
    description: 'Library tab to show',
    enum: portalItemTypeFilters,
    default: 'all',
  })
  @IsOptional()
  @IsIn(portalItemTypeFilters)
  type: PortalItemTypeFilter = 'all';

  @ApiPropertyOptional({
    description: 'Case-insensitive title search',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

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
