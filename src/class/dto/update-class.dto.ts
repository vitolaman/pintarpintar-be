import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  ClassCategory,
  ClassSkillCategory,
  LearningLevel,
  MAX_LEARNING_OUTCOMES,
  classCategories,
  classSkillCategories,
  learningLevels,
} from '../../common/catalog/class-details';
import { ClassStatus } from '../entities/class.entity';
import { ClassKind, classKinds } from '../../common/catalog/item-kind';
import { CoverAssetIds } from '~/api/item-cover/cover-asset-ids.decorator';
import { assetFieldDescription } from '../../api/file-asset/asset-purpose-rules';
import {
  ClearableText,
  EnumInput,
  NumberInput,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { MAX_DESCRIPTION_LENGTH } from './content-validation';

// Omitted fields stay unchanged; null or "" clears a nullable field and is
// rejected for the others.
export class UpdateClassDto {
  @RequiredText({ max: 255, optional: true })
  title?: string;

  @ClearableText({ max: MAX_DESCRIPTION_LENGTH })
  description?: string | null;

  @EnumInput(classKinds, {
    presence: 'optional',
    description:
      '`kelas` is a video class, `bootcamp` a live bootcamp; a bootcamp with meetings cannot become `kelas`',
  })
  type?: ClassKind;

  @EnumInput(Object.values(ClassStatus), {
    presence: 'optional',
    description: '`archived` means unlisted: hidden from lists, open by link',
  })
  status?: ClassStatus;

  @NumberInput({ presence: 'optional', min: 0 })
  original_price?: number;

  @NumberInput({
    presence: 'nullable',
    min: 0,
    description:
      'Selling price; when greater than 0, must not exceed original_price. Null removes the discount',
  })
  discount_price?: number | null;

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

  @ClearableText({ max: 5000 })
  post_purchase_instructions?: string | null;

  @EnumInput(classCategories, { presence: 'nullable', description: 'Bidang' })
  category?: ClassCategory | null;

  @EnumInput(classSkillCategories, {
    presence: 'optional',
    description: 'Kategori Skill; omit to keep it. Cannot be cleared.',
  })
  skill_category?: ClassSkillCategory;

  @EnumInput(learningLevels, { presence: 'nullable' })
  level?: LearningLevel | null;

  @ClearableText({ max: 60 })
  duration?: string | null;

  @ClearableText({ max: 2000 })
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
