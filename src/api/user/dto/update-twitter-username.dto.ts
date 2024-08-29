import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateTwitterUsernameDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'DarkSouls' })
  twitterUsername: string;
}
