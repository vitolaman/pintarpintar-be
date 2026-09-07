import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Budi Santoso' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @ApiPropertyOptional({ example: '+62 812-3456-7890' })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Transform(({ value }) => value?.trim())
  phone?: string;

  @ApiPropertyOptional({ example: 'Belajar skill teknik praktis' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  @Transform(({ value }) => value?.trim())
  headline?: string;

  @ApiPropertyOptional({ example: 'Sedang memperdalam desain dan otomasi.' })
  @IsOptional()
  @IsString()
  @Length(1, 2_000)
  @Transform(({ value }) => value?.trim())
  bio?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  avatar_asset_id?: string | null;
}
