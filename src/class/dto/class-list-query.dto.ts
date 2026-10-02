import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ClassStatus, ClassType } from '../entities/class.entity';
import { LimitQuery, PageQuery } from '~/common/dto/request-paginated.dto';

export class ClassListQueryDto {
  @PageQuery()
  page?: number = 1;

  @LimitQuery()
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
