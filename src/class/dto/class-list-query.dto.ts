import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ClassStatus, ClassType } from '../entities/class.entity';

export class ClassListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ enum: ClassStatus })
  @IsEnum(ClassStatus)
  @IsOptional()
  status?: ClassStatus;

  @ApiPropertyOptional({ enum: ClassType })
  @IsEnum(ClassType)
  @IsOptional()
  type?: ClassType;
}
