import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';

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

  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;
}
