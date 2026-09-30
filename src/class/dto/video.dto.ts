import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { HTTPS_URL } from './content-validation';

export class CreateVideoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'https YouTube or embed link; video files are not accepted',
  })
  @IsUrl(HTTPS_URL)
  @MaxLength(2048)
  youtubeUrl: string;

  @ApiProperty({ required: false, example: '12:30' })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  duration?: string;
}

export class UpdateVideoDto {
  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional()
  @ValidateIf((_, value) => value !== undefined)
  @IsUrl(HTTPS_URL)
  @MaxLength(2048)
  youtubeUrl?: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(32)
  @IsOptional()
  duration?: string | null;
}
