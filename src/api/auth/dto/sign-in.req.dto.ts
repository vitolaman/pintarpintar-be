import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { RequiredText } from '~/common/decorator/input.decorator';

export class SignInBodyDto {
  @RequiredText({ max: 255, example: 'john.doe@gmail.com' })
  @IsEmail()
  email: string;

  // Passwords are never trimmed: spaces are part of the secret.
  @ApiProperty({ example: 'qwerty1!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
