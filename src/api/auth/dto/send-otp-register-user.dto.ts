import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendOtpRegisterUser {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty({ message: 'validation.NOT_EMPTY' })
  email: string;
}
