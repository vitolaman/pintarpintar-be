import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
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
    minSymbols: 0,
    minLowercase: 0,
    minUppercase: 0,
  })
  @ApiProperty({ example: '********' })
  password: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '1a61fa50' })
  referralCode: string;

  @Exclude()
  @ApiHideProperty()
  predictToken: number;

  @IsString()
  @ApiProperty({ example: 'xxxxxxxxxxxxxxx' })
  deviceToken: string;
}
