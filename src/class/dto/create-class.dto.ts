import { ApiProperty } from '@nestjs/swagger';
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
    description: assetFieldDescription('class_cover', 'The main cover.'),
  })
  @IsUUID()
  @IsOptional()
  cover_asset_id?: string;

  @CoverAssetIds('class_cover')
  cover_asset_ids?: string[];

  @ApiProperty({ required: false, maxLength: 5000 })
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  post_purchase_instructions?: string;

  @ApiProperty({
    required: false,
    enum: classCategories,
    description: 'Bidang',
  })
  @IsIn(classCategories)
  @IsOptional()
  category?: ClassCategory;

  @ApiProperty({ required: false, enum: learningLevels })
  @IsIn(learningLevels)
  @IsOptional()
  level?: LearningLevel;

  @ApiProperty({ required: false, maxLength: 60, example: '8 minggu' })
  @IsString()
  @MaxLength(60)
  @IsOptional()
  duration?: string;

  @ApiProperty({ required: false, maxLength: 2000, description: 'Prasyarat' })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  prerequisites?: string;

  @ApiProperty({
    required: false,
    type: [String],
    maxItems: MAX_LEARNING_OUTCOMES,
    description: 'Hasil Pembelajaran',
  })
  @IsArray()
  @ArrayMaxSize(MAX_LEARNING_OUTCOMES)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(200, { each: true })
  @IsOptional()
  learning_outcomes?: string[];
}
