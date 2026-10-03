import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeachingClassResponseDto } from '../../mentor/dto/mentor-workspace.dto';
import { ONBOARDING_ROLES, OnboardingRole } from '../onboarding.constants';
import { classKinds } from '~/common/catalog/item-kind';

export const learningItemTypes = [...classKinds, 'digital'] as const;
export type LearningItemType = (typeof learningItemTypes)[number];

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

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Avatar asset; send it back to keep it',
  })
  avatar_asset_id: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  headline: string | null;

  @ApiPropertyOptional({ nullable: true })
  bio: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Null unless the user is a mentor',
  })
  mentor_id: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Null unless the user is a merchant',
  })
  merchant_id: string | null;

  @ApiProperty({ description: 'Account creation time' })
  member_since: Date;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      'Avatar URL built from ASSET_PUBLIC_BASE_URL; null without an avatar or when unset',
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
  @ApiProperty({
    format: 'uuid',
    description: 'Enrollment id for kelas and bootcamp; access id for digital',
  })
  access_id: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Class id for kelas and bootcamp; digital product id for digital',
  })
  item_id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: learningItemTypes, example: 'kelas' })
  item_type: LearningItemType;

  @ApiPropertyOptional({ nullable: true })
  level: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      'Public cover URL; null without a cover or ASSET_PUBLIC_BASE_URL',
  })
  cover_url: string | null;

  @ApiProperty({
    example: 70,
    description:
      'Classes: completed videos over all videos, whole percent (100 without videos); digital: the stored progress, 0 without one',
  })
  completion_percentage: number;

  @ApiProperty({ enum: ['not_started', 'in_progress', 'completed'] })
  progress_status: 'not_started' | 'in_progress' | 'completed';

  @ApiProperty({
    description: 'Digital: the stored time spent, 0 without one; classes: 0',
  })
  total_time_spent: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Classes: the latest video completion; digital: the stored last access',
  })
  last_accessed_at: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Null for classes and for access without an end',
  })
  expires_at: Date | null;
}

export class CertificationItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ nullable: true, example: 'PP-CERT-2026-0001' })
  certificate_number: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-09-25' })
  issued_on: string | null;

  @ApiProperty({ format: 'uuid' })
  class_id: string;

  @ApiProperty({ example: 'Revit Architecture untuk Pemula' })
  class_title: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Sari Digital Studio',
    description: 'Class merchant',
  })
  issuer_name: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Certificate file for the owner; uploaded files are signed links valid 10 minutes, older rows keep their stored URL',
  })
  file_url: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "The class's first assigned mentor",
  })
  mentor_name: string | null;

  @ApiProperty({
    type: [String],
    example: ['Sipil'],
    description: 'The class Bidang; empty when unset',
  })
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
  @ApiProperty({ description: 'Kelas Bootcamp Diikuti: active enrollments' })
  bootcamp_count: number;

  @ApiProperty({ description: 'Kelas Video Diikuti: active enrollments' })
  video_class_count: number;

  @ApiProperty({
    description:
      'Produk Digital Dibeli: products with unexpired access, including ones their merchant deleted',
  })
  digital_product_count: number;

  @ApiProperty({ description: 'Sertifikat Diperoleh: issued certificates' })
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

  @ApiPropertyOptional({ nullable: true, example: 'PP-CERT-2026-0001' })
  certificate_number: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-09-25' })
  issued_on: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Class merchant' })
  issuer_name: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "The class's first assigned mentor",
  })
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
