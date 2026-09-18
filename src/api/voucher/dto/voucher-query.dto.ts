import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { RequestPaginatedQueryWithSearchDto } from '~/common/dto/request-paginated.dto';

export class PublicVoucherQueryDto extends RequestPaginatedQueryWithSearchDto {
  @ApiPropertyOptional({ example: 'teknik-arsitektur' })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  category_slug?: string;
}
