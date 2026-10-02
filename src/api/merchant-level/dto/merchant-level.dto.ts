import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MerchantStorageLevel } from '../../merchant/entities/merchant.entity';

export class MerchantLevelSummaryDto {
  @ApiProperty({ enum: MerchantStorageLevel, example: 'basic' })
  current: MerchantStorageLevel;

  @ApiProperty({
    example: 1200000,
    description: 'Net of paid sales this month so far (Asia/Jakarta), IDR',
  })
  current_month_revenue: number;

  @ApiProperty({ example: 2500000, description: 'Monthly revenue for Silver' })
  silver_threshold: number;

  @ApiProperty({ example: 5000000, description: 'Monthly revenue for Gold' })
  gold_threshold: number;

  @ApiProperty({
    example: 1073741824,
    description:
      'Per-file limit for class materials, assignment files and digital-product files',
  })
  max_upload_bytes: number;

  @ApiProperty({
    example: 32212254720,
    description:
      'Storage quota of the level, enforced when content files are attached (covers and profile images do not count)',
  })
  storage_quota_bytes: number;

  @ApiProperty({
    example: 3221225472,
    description:
      'Bytes used by distinct files attached to live class materials, class videos, assignment attachments and digital-product files',
  })
  storage_used_bytes: number;

  @ApiProperty({ example: '2026-09', nullable: true, type: String })
  last_evaluated_month: string | null;

  @ApiProperty({ example: '2026-11-01T00:30:00+07:00' })
  next_evaluation_at: string;

  @ApiProperty({
    description:
      'True when the last evaluation warned that items will be removed after another month without sales',
  })
  inactivity_warning: boolean;
}

export class LevelEvaluationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 12;
}

export class LevelEvaluationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-09', description: 'Evaluated month' })
  month: string;

  @ApiProperty({ example: 3000000 })
  revenue: number;

  @ApiProperty({ example: 1200000 })
  previous_month_revenue: number;

  @ApiProperty({ enum: MerchantStorageLevel })
  previous_level: MerchantStorageLevel;

  @ApiProperty({ enum: MerchantStorageLevel })
  new_level: MerchantStorageLevel;

  @ApiProperty({ enum: ['none', 'warning', 'removed'] })
  inactivity_action: string;

  @ApiProperty({ example: 0 })
  removed_items: number;

  @ApiProperty()
  evaluated_at: Date;
}
