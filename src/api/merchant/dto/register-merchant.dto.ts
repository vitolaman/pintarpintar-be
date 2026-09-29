import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

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

  @ApiPropertyOptional({ nullable: true, default: false, example: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  need_change_password?: boolean | null;
}
