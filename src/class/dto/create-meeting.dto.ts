import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMeetingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  date: string; // Using string for YYYY-MM-DD

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  time: string; // Using string for HH:mm:ss

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  liveUrl?: string;
}
