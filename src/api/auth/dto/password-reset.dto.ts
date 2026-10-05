import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MaxLength,
} from 'class-validator';
import { RequiredText } from '~/common/decorator/input.decorator';

export class RequestPasswordResetDto {
  @RequiredText({ max: 255, example: 'ayu.lestari@example.com' })
  @IsEmail()
  email: string;
}

export class ConfirmPasswordResetDto {
  // Any string is accepted here: a token of the wrong shape gets the same
  // 400 as an unknown one, so the two cannot be told apart.
  @ApiProperty({
    description: 'The `token` query parameter of the reset link',
    example: 'Q2hhbmdlLW1lLXRvLWEtcmVhbC10b2tlbi1mcm9tLXRoZQ',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;

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
  @MaxLength(128)
  new_password: string;
}
