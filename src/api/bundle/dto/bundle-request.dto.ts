import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { bundleStatuses, BundleStatus } from '../entities/bundle.entity';

export const bundleItemTypes = ['kelas', 'digital'] as const;

export type BundleItemType = (typeof bundleItemTypes)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class BundleItemInputDto {
  @ApiProperty({
    enum: bundleItemTypes,
    description: 'kelas = class, digital = digital product',
  })
  @IsIn(bundleItemTypes)
  type: BundleItemType;

  @ApiProperty({ description: 'Class id or digital product id' })
  @IsUUID()
  id: string;
}

export class CreateBundleDto {
  @ApiProperty({ example: 'Paket AutoCAD & Template RAB', maxLength: 160 })
  @Transform(trim)
  @IsString()
  @Length(1, 160)
  title: string;

  @ApiProperty({
    example: 'Kelas AutoCAD lengkap plus template RAB siap pakai.',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 5000)
  description: string;

  @ApiPropertyOptional({ nullable: true, description: 'Uploaded cover asset' })
  @IsOptional()
  @IsUUID()
  cover_asset_id?: string | null;

  @ApiProperty({
    example: 349000,
    description: 'Must be below the items total',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  bundle_price: number;

  @ApiPropertyOptional({ nullable: true, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  post_purchase_instructions?: string | null;

  @ApiPropertyOptional({ enum: bundleStatuses, default: 'published' })
  @IsOptional()
  @IsIn(bundleStatuses)
  status?: BundleStatus;

  @ApiProperty({ type: [BundleItemInputDto], minItems: 2, maxItems: 20 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BundleItemInputDto)
  items: BundleItemInputDto[];
}

export class UpdateBundleDto extends PartialType(CreateBundleDto) {}

export class BundleListQueryDto {
  @ApiPropertyOptional({ enum: bundleStatuses })
  @IsOptional()
  @IsIn(bundleStatuses)
  status?: BundleStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
