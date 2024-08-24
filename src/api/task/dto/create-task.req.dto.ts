import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

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
}
