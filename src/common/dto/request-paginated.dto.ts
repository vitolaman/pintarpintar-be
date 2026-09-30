import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, Max, Min } from 'class-validator';

const toInteger = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Number(value);

export class RequestPaginatedQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class RequestPaginatedQueryWithSearchDto extends RequestPaginatedQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  search?: string;
}
