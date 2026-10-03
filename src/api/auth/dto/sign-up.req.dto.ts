import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from 'class-validator';
import { RequiredText } from '~/common/decorator/input.decorator';

export class SignUpBodyDto {
  @RequiredText({ max: 120, example: 'John Doe' })
  name: string;

  @RequiredText({ max: 255, example: 'john.doe@gmail.com' })
  @IsEmail()
  email: string;

  // Passwords are never trimmed: spaces are part of the secret.
  @ApiProperty({
    example: '********',
    description: 'At least 8 characters with at least one digit',
  })
  @IsString()
  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 0,
    minLowercase: 0,
    minUppercase: 0,
  })
  password: string;
}
