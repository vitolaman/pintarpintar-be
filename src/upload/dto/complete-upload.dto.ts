import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';

export class UploadPartDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ETag: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  PartNumber: number;
}

export class CompleteUploadDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ type: [UploadPartDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadPartDto)
  parts: UploadPartDto[];
}
