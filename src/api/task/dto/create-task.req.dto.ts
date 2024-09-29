import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
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
  @ApiProperty({ example: '1' })
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

  @ValidateIf((o) => o.type === '5')
  @IsArray()
  @ArrayNotEmpty()
  @ApiPropertyOptional({
    example: [10, 20, 30, 40, 50],
    description:
      'Only Mandatory for type 5. Points a user earns at each streak milestone',
  })
  loginStreakMetadata: number[];
}
