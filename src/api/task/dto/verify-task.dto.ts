import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyTaskDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ example: '950af2ca-7e4e-40cc-bef5-1b71af705dc6' })
  masterTaskId: string;
}
