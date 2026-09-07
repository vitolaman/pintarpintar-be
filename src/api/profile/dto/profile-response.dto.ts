import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  is_mentor: boolean;

  @ApiProperty()
  is_merchant: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  avatar_asset_id: string | null;

  @ApiPropertyOptional()
  avatar_object_key: string | null;

  @ApiPropertyOptional()
  phone: string | null;

  @ApiPropertyOptional()
  headline: string | null;

  @ApiPropertyOptional()
  bio: string | null;
}

export class LearningItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  access_id: string;

  @ApiProperty({ format: 'uuid' })
  product_id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  product_type: string;

  @ApiPropertyOptional()
  level: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  cover_asset_id: string | null;

  @ApiPropertyOptional()
  cover_object_key: string | null;

  @ApiProperty({ example: 70 })
  completion_percentage: number;

  @ApiProperty({ enum: ['not_started', 'in_progress', 'completed'] })
  progress_status: 'not_started' | 'in_progress' | 'completed';

  @ApiProperty()
  total_time_spent: number;

  @ApiPropertyOptional()
  last_accessed_at: Date | null;

  @ApiPropertyOptional()
  expires_at: Date | null;
}
