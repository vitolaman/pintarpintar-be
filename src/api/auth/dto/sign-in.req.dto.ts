import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { CheckPasswordBodyDto } from './check-password.req.dto';

export class SignInBodyDto extends CheckPasswordBodyDto {
  @IsString()
  @ApiProperty({ example: 'john.doe@gmail.com' })
  email: string;
}
