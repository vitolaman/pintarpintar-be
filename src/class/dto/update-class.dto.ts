import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ClassStatus, ClassType } from '../entities/class.entity';

// Omitted fields stay unchanged; null clears a nullable field and is
// rejected for the others.
export class UpdateClassDto {
  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ValidateIf((_, value) => value !== undefined)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ enum: ClassType })
  @IsEnum(ClassType)
  @ValidateIf((_, value) => value !== undefined)
  type?: ClassType;

  @ApiPropertyOptional({
    enum: ClassStatus,
    description: '`archived` means unlisted: hidden from lists, open by link',
  })
  @IsEnum(ClassStatus)
  @ValidateIf((_, value) => value !== undefined)
  status?: ClassStatus;

  @ApiPropertyOptional({ minimum: 0 })
  @IsNumber()
  @Min(0)
  @ValidateIf((_, value) => value !== undefined)
  originalPrice?: number;

  @ApiPropertyOptional({
    minimum: 0,
    nullable: true,
    description:
      'Selling price; when greater than 0, must not exceed originalPrice. Null removes the discount',
  })
  @IsNumber()
  @Min(0)
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  discountedPrice?: number | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'File asset registered with purpose class_cover',
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  @IsOptional()
  cover_asset_id?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  post_purchase_instructions?: string | null;
}
