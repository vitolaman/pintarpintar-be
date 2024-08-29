import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTaskDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Like Our X post' })
  name: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    example: 'https://x.com/__SeriousGemini/status/1806822759764488578',
  })
  url: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'twitter like post' })
  type: string;

  @IsNotEmpty()
  @IsBoolean()
  @ApiProperty({ example: false })
  isRepeatable: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({ example: false })
  isUnlimited: boolean;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 3 })
  maxRepeat: number;

  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 1 })
  repeatableType: number;

  @IsNotEmpty()
  @IsNumber()
  @ApiProperty({ example: 1 })
  token: number;
}
