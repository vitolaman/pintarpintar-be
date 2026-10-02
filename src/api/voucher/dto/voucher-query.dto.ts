import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';
import { QueryFilter } from '~/common/decorator/input.decorator';
import { RequestPaginatedQueryWithSearchDto } from '~/common/dto/request-paginated.dto';

export class PublicVoucherQueryDto extends RequestPaginatedQueryWithSearchDto {
  @ApiPropertyOptional({
    example: 'teknik-arsitektur',
    description: 'A blank value means every category',
  })
  @QueryFilter()
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  category_slug?: string;

  @ApiPropertyOptional({
    example: 'akademi-teknik-raka',
    description: 'A blank value means every merchant',
  })
  @QueryFilter()
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  merchant_slug?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Merchant id; the public merchant page is addressed by id. A blank value means every merchant.',
  })
  @QueryFilter()
  @IsOptional()
  @IsUUID()
  merchant_id?: string;
}
