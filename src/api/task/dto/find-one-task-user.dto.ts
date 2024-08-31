import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ResponseDto } from '~/common/dto/response.dto-default';

export class FindOneTaskUserDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '950af2ca-7e4e-40cc-bef5-1b71af705dc6' })
  masterTaskId: string;
}

export class FindOneTaskUserResDto extends ResponseDto<any> {}
