import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';

export class ChangePasswordDto {
  // Checked against the stored hash only; older passwords may predate the
  // current strength rule.
  @ApiProperty({ example: '********' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  current_password: string;

  @ApiProperty({
    example: '********',
    description: 'At least 8 characters with at least one digit',
  })
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 0,
    minLowercase: 0,
    minUppercase: 0,
  })
  @MaxLength(128)
  new_password: string;
}
