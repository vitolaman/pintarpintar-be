import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ResponseDto } from '~/common/dto/response.dto-default';

export class AdminSignInBodyDto {
  @IsString()
  @ApiProperty({ example: 'john.doe@gmail.com' })
  email: string;

  @IsString()
  @ApiProperty({ example: 'qwerty1!' })
  password: string;
}

export class AdminSignInResDto extends ResponseDto<any> {
  data: {
    token: string;
  };
}
