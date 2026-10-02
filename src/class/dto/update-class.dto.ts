import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  ClassCategory,
  LearningLevel,
  MAX_LEARNING_OUTCOMES,
  classCategories,
  learningLevels,
} from '../../common/catalog/class-details';
import { ClassStatus, ClassType } from '../entities/class.entity';
import { CoverAssetIds } from '~/api/item-cover/cover-asset-ids.decorator';
import { assetFieldDescription } from '../../api/file-asset/asset-purpose-rules';

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
    description: assetFieldDescription(
      'class_cover',
      'Sets the main cover and keeps the others; null removes the main cover and the next one takes its place.',
    ),
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  @IsOptional()
  cover_asset_id?: string | null;

  @CoverAssetIds('class_cover')
  cover_asset_ids?: string[];

  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  post_purchase_instructions?: string | null;

  @ApiPropertyOptional({
    enum: classCategories,
    nullable: true,
    description: 'Bidang',
  })
  @ValidateIf((_, value) => value !== null)
  @IsIn(classCategories)
  @IsOptional()
  category?: ClassCategory | null;

  @ApiPropertyOptional({ enum: learningLevels, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsIn(learningLevels)
  @IsOptional()
  level?: LearningLevel | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 60 })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(60)
  @IsOptional()
  duration?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  prerequisites?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: [String],
    maxItems: MAX_LEARNING_OUTCOMES,
  })
  @ValidateIf((_, value) => value !== null)
  @IsArray()
  @ArrayMaxSize(MAX_LEARNING_OUTCOMES)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(200, { each: true })
  @IsOptional()
  learning_outcomes?: string[] | null;
}
