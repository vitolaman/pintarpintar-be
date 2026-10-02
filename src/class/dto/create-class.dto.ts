import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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
import {
  ClearableText,
  EnumInput,
  NumberInput,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { MAX_DESCRIPTION_LENGTH } from './content-validation';

export class CreateClassDto {
  @RequiredText({ max: 255 })
  title: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
  description?: string | null;

  @EnumInput(Object.values(ClassStatus), {
    presence: 'optional',
    default: ClassStatus.DRAFT,
    description: '`archived` means unlisted: hidden from lists, open by link',
  })
  status?: ClassStatus;

  @EnumInput(Object.values(ClassType), {
    presence: 'optional',
    default: ClassType.VIDEO,
  })
  type?: ClassType;

  @NumberInput({ presence: 'optional', min: 0 })
  originalPrice?: number;

  @NumberInput({
    presence: 'nullable',
    min: 0,
    description: 'When greater than 0, must not exceed originalPrice',
  })
  discountedPrice?: number | null;

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

  @ClearableText({ max: 5000 })
  post_purchase_instructions?: string | null;

  @EnumInput(classCategories, { presence: 'nullable', description: 'Bidang' })
  category?: ClassCategory | null;

  @EnumInput(learningLevels, { presence: 'nullable' })
  level?: LearningLevel | null;

  @ClearableText({ max: 60, example: '8 minggu' })
  duration?: string | null;

  @ClearableText({ max: 2000, description: 'Prasyarat' })
  prerequisites?: string | null;

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
