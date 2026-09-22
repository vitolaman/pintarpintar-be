import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ClassStatus, ClassType } from '../entities/class.entity';

export class CreateClassDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ClassStatus, default: ClassStatus.DRAFT })
  @IsEnum(ClassStatus)
  @IsOptional()
  status?: ClassStatus;

  @ApiProperty({ enum: ClassType, default: ClassType.VIDEO })
  @IsEnum(ClassType)
  @IsOptional()
  type?: ClassType;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  originalPrice?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  discountedPrice?: number;
}
