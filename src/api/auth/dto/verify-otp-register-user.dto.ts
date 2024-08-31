import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class VerifyOtpRegisterUserDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  email: string;

  @ApiProperty()
  @IsString({ message: 'validation.INVALID_STRING' })
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  otp: string;
}
