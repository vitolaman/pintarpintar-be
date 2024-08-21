import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class CheckEmailBodyDto {
  @IsEmail()
  @ApiProperty({ example: 'john.doe@gmail.com' })
  email: string;
}
