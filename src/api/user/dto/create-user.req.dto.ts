import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from 'class-validator';
import { CheckPasswordBodyDto } from '~/api/auth/dto/check-password.req.dto';

export class CreateUserBodyDto extends CheckPasswordBodyDto {
  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({ example: 'john.doe@gmail.com' })
  email: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'thehashslingingslasher' })
  username: string;

  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 1,
    minLowercase: 0,
    minUppercase: 0,
  })
  @ApiProperty({ example: '********' })
  password: string;
}
