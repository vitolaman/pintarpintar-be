import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

export class CheckPhoneBodyDto {
  @IsPhoneNumber()
  @ApiProperty({ example: '+6281386587585' })
  phone: string;
}
