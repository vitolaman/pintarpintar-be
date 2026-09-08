import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class RegisterMerchantDto {
  @ApiProperty({ example: 'Akademi Teknik Nusantara' })
  @IsString()
  @Length(1, 160)
  @Transform(({ value }) => value?.trim())
  store_name: string;

  @ApiProperty({ example: 'Kelas dan bootcamp teknik untuk profesional.' })
  @IsString()
  @Length(1, 2_000)
  @Transform(({ value }) => value?.trim())
  store_description: string;
}
