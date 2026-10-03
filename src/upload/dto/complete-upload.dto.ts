import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class UploadPartDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ETag: string;

  // S3 numbers multipart parts 1 to 10,000.
  @ApiProperty({ minimum: 1, maximum: 10000 })
  @IsInt()
  @Min(1)
  @Max(10000)
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
