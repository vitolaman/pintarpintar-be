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

  @ApiPropertyOptional({
    description: 'Avatar URL built from ASSET_PUBLIC_BASE_URL; null when unset',
  })
  avatar_url: string | null;

  @ApiProperty({
    type: [String],
    example: ['AutoCAD', 'Structural Design'],
    description: 'Mentor skills (Keahlian Saya); empty for non-mentors',
  })
  expertise_list: string[];
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

  @ApiPropertyOptional({
    description:
      'Certificate file for the owner; uploaded files are signed links valid 10 minutes',
  })
  file_url: string | null;

  @ApiPropertyOptional({ description: "The class's first assigned mentor" })
  mentor_name: string | null;

  @ApiProperty({ type: [String], example: [] })
  skills: string[];

  @ApiPropertyOptional({
    example: 88.5,
    nullable: true,
    description: 'Average of graded assignments in the class',
  })
  final_score: number | null;

  @ApiPropertyOptional({
    example: '88.5',
    nullable: true,
    description: 'final_score as text',
  })
  grade: string | null;
}

export class LearningStatisticsResponseDto {
  @ApiProperty({ description: 'Kelas Bootcamp Diikuti' })
  bootcamp_count: number;

  @ApiProperty({ description: 'Kelas Video Diikuti' })
  video_class_count: number;

  @ApiProperty({ description: 'Produk Digital Dibeli' })
  digital_product_count: number;

  @ApiProperty({ description: 'Sertifikat Diperoleh' })
  certificate_count: number;
}
