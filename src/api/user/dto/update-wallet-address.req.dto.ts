import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateWalletAddressDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '0xFFFFFFFFFFFFFFFFFF' })
  address: string;
}
