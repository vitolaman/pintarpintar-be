import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ResponseArrayDto } from '~/common/dto/response.dto-default';
import { MasterCountry } from '../entities/master-country.entity';

export class GetMasterCountryDto {
  @ApiPropertyOptional()
  @IsString({ message: 'validation.INVALID_STRING' })
  @IsOptional()
  keyword: string;
}

export class FindAllMasterCountryResDto extends ResponseArrayDto<MasterCountry> {}
