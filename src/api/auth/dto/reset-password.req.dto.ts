import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword, IsUUID } from 'class-validator';

export class ResetPasswordBodyDto {
  @IsUUID()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minLowercase: 0,
    minUppercase: 0,
  })
  @ApiProperty({ example: 'qwerty1!' })
  password: string;
}
