import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UploadPfpDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'https://www.google.com.sg/' })
  profilePicUrl: string;
}
