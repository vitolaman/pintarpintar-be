import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SignInBodyDto {
  @IsString()
  @ApiProperty({ example: 'john.doe@gmail.com' })
  email: string;

  @IsString()
  @ApiProperty({ example: 'qwerty1!' })
  password: string;

  @IsString()
  @ApiProperty({ example: 'xxxxxxxxxxxxxxx' })
  deviceToken: string;
}
