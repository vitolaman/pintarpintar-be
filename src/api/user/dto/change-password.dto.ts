import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 0,
    minLowercase: 0,
    minUppercase: 0,
  })
  @ApiProperty({ example: '********' })
  oldPassword: string;

  @ApiProperty()
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 0,
    minLowercase: 0,
    minUppercase: 0,
  })
  @ApiProperty({ example: '********' })
  newPassword: string;
}
