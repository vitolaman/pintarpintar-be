import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateCurrentUserBodyDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: 'Jane Doe' })
  name: string;
}
