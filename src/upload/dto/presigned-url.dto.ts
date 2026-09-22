import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class PresignedUrlDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  partsCount: number;
}
