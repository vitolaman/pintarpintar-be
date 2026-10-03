import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { EnumInput, QueryFilter } from '~/common/decorator/input.decorator';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';
import { classKinds } from '~/common/catalog/item-kind';

export const portalItemTypes = [...classKinds, 'digital'] as const;

export type PortalItemType = (typeof portalItemTypes)[number];

export const portalItemTypeFilters = ['all', ...portalItemTypes] as const;

export type PortalItemTypeFilter = (typeof portalItemTypeFilters)[number];

export class PortalItemQueryDto {
  // a blank tab means every tab.
  @EnumInput(portalItemTypeFilters, {
    presence: 'filter',
    default: 'all',
    description: 'Library tab to show',
  })
  type: PortalItemTypeFilter = 'all';

  @ApiPropertyOptional({
    description: 'Case-insensitive title search; a blank value means none',
    maxLength: 100,
  })
  @QueryFilter()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @PageQuery()
  page = 1;

  @LimitQuery()
  limit = 10;
}
