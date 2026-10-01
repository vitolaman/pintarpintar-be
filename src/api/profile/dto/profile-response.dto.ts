import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeachingClassResponseDto } from '../../mentor/dto/mentor-workspace.dto';
import { ONBOARDING_ROLES, OnboardingRole } from '../onboarding.constants';

export class OnboardingResponseDto {
  @ApiPropertyOptional({ enum: ONBOARDING_ROLES, nullable: true })
  role: OnboardingRole | null;

  @ApiPropertyOptional({ nullable: true })
  custom_role: string | null;

  @ApiProperty({ type: [String], example: ['AutoCAD', 'BIM'] })
  skills: string[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Null until onboarding is saved',
  })
  completed_at: Date | null;
}

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

  @ApiProperty({
    type: OnboardingResponseDto,
    description: 'Onboarding answers; never grants the mentor or merchant role',
  })
  onboarding: OnboardingResponseDto;
}

export class LearningItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  access_id: string;

  @ApiProperty({ format: 'uuid' })
  product_id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({
    example: 'kelas',
    description:
      "`kelas` (video class), `bootcamp` (live bootcamp), or the digital product's type",
  })
  product_type: string;

  @ApiPropertyOptional()
  level: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  cover_asset_id: string | null;

  @ApiPropertyOptional()
  cover_object_key: string | null;

  @ApiPropertyOptional({ description: 'Public cover URL' })
  cover_url: string | null;

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

export class PublicProfileMerchantDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ nullable: true })
  slug: string | null;

  @ApiProperty()
  store_name: string;
}

export class PublicProfileMentorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: [String] })
  expertise_list: string[];
}

export class TeachingStatisticsDto {
  @ApiProperty({ example: 3 })
  classes_count: number;

  @ApiProperty({ example: 2 })
  active_classes_count: number;

  @ApiProperty({ example: 120 })
  students_count: number;
}

export class PublicCertificateDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  class_id: string;

  @ApiProperty()
  class_title: string;

  @ApiPropertyOptional({ example: 'PP-CERT-2026-0001' })
  certificate_number: string | null;

  @ApiPropertyOptional({ example: '2026-09-25' })
  issued_on: string | null;

  @ApiPropertyOptional()
  issuer_name: string | null;

  @ApiPropertyOptional()
  mentor_name: string | null;
}

// Public view of any user; never carries email, phone, or file links.
export class PublicProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  avatar_url: string | null;

  @ApiPropertyOptional({ nullable: true })
  headline: string | null;

  @ApiPropertyOptional({ nullable: true })
  bio: string | null;

  @ApiProperty()
  member_since: Date;

  @ApiProperty()
  is_mentor: boolean;

  @ApiProperty()
  is_merchant: boolean;

  @ApiPropertyOptional({ type: PublicProfileMerchantDto, nullable: true })
  merchant: PublicProfileMerchantDto | null;

  @ApiPropertyOptional({ type: PublicProfileMentorDto, nullable: true })
  mentor: PublicProfileMentorDto | null;

  @ApiProperty({ type: LearningStatisticsResponseDto })
  learning_statistics: LearningStatisticsResponseDto;

  @ApiPropertyOptional({ type: TeachingStatisticsDto, nullable: true })
  teaching_statistics: TeachingStatisticsDto | null;

  @ApiProperty({ type: [TeachingClassResponseDto] })
  teaching_classes: TeachingClassResponseDto[];

  @ApiProperty({ type: [PublicCertificateDto] })
  certificates: PublicCertificateDto[];
}
