import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ResponseArrayDto } from '~/common/dto/response.dto-default';
import { MasterProfilePicture } from '../entities/master-pfp.entity';

export class GetMasterPfpDto {
  @ApiPropertyOptional()
  @IsString({ message: 'validation.INVALID_STRING' })
  @IsOptional()
  keyword: string;
}

export class FindAllMasterPfpResDto extends ResponseArrayDto<MasterProfilePicture> {}
