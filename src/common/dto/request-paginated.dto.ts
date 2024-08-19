import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class RequestPaginatedQueryDto {
  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value || 1))
  page?: number = 1;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value || 10))
  limit?: number = 10;
}

export class RequestPaginatedQueryWithSearchDto extends RequestPaginatedQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  search?: string;
}
