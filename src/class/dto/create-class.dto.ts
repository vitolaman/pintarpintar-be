import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ClassStatus, ClassType } from '../entities/class.entity';

export class CreateClassDto {
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
    enum: ClassStatus,
    default: ClassStatus.DRAFT,
    description: '`archived` means unlisted: hidden from lists, open by link',
  })
  @IsEnum(ClassStatus)
  @IsOptional()
  status?: ClassStatus;

  @ApiProperty({ enum: ClassType, default: ClassType.VIDEO })
  @IsEnum(ClassType)
  @IsOptional()
  type?: ClassType;

  @ApiProperty({ required: false, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  originalPrice?: number;

  @ApiProperty({
    required: false,
    minimum: 0,
    description: 'When greater than 0, must not exceed originalPrice',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountedPrice?: number;

  @ApiProperty({
    required: false,
    format: 'uuid',
    description: 'File asset registered with purpose class_cover',
  })
  @IsUUID()
  @IsOptional()
  cover_asset_id?: string;

  @ApiProperty({ required: false, maxLength: 5000 })
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  post_purchase_instructions?: string;
}
