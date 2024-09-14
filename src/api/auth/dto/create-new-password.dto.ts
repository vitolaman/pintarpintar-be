import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from 'class-validator';

export class CreateNewPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  token: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  email: string;

  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 0,
    minLowercase: 0,
    minUppercase: 0,
  })
  @ApiProperty({ example: '********' })
  password: string;

  @IsString()
  @ApiProperty({ example: 'xxxxxxxxxxxxxxx' })
  deviceToken: string;
}
