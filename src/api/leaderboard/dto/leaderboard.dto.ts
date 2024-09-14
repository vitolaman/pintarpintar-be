import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LeaderboardDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '' })
  categoryId?: string;
}
