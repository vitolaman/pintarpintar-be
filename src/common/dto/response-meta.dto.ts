import { ApiProperty } from '@nestjs/swagger';

export class ResponseMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10, description: 'Items per page' })
  limit: number;

  @ApiProperty({ example: 42, description: 'Items across all pages' })
  total: number;

  @ApiProperty({ example: 5, description: 'Number of pages; 0 when empty' })
  total_page: number;
}

export function paginationMeta(
  page: number,
  limit: number,
  total: number,
): ResponseMetaDto {
  return { page, limit, total, total_page: Math.ceil(total / limit) };
}
