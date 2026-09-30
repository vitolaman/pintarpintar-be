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

  @ApiPropertyOptional({ format: 'uuid' })
  mentor_id: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  merchant_id: string | null;

  @ApiProperty({ description: 'Account creation time' })
  member_since: Date;
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

export class CertificationItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ example: 'PP-CERT-2026-0001' })
  certificate_number: string | null;

  @ApiPropertyOptional({ example: '2026-09-25' })
  issued_on: string | null;

  @ApiProperty({ format: 'uuid' })
  class_id: string;

  @ApiProperty({ example: 'Revit Architecture untuk Pemula' })
  class_title: string;

  @ApiPropertyOptional({
    example: 'Sari Digital Studio',
    description: 'Class merchant',
  })
  issuer_name: string | null;

  @ApiPropertyOptional({ description: 'Certificate file for the owner' })
  file_url: string | null;
}
