import { ClassKind, classKinds } from '~/common/catalog/item-kind';
import { TUTOR_ROLES } from '~/class/class-permissions';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// A mentor created by an accepted job application has no mentor profile
// until the mentor registration is completed; its professional fields and
// documents read null until then.
export class MentorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  user_id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true, type: String })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  headline: string | null;

  @ApiPropertyOptional({ nullable: true })
  bio: string | null;

  @ApiProperty({ nullable: true, type: String })
  expertise: string | null;

  @ApiProperty({ type: [String], example: ['AutoCAD', 'SAP2000'] })
  expertise_list: string[];

  @ApiProperty({ nullable: true, type: Number })
  experience_years: number | null;

  @ApiProperty({ nullable: true, type: String })
  education: string | null;

  @ApiPropertyOptional({ nullable: true })
  portfolio_url: string | null;

  @ApiProperty({ nullable: true, type: String })
  linkedin_url: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  cv_asset_id: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  skill_certificate_asset_id: string | null;

  @ApiProperty({
    description:
      'false until the mentor registration (profile and documents) is completed',
  })
  registration_complete: boolean;
}

export class MentorMerchantAssignmentDto {
  @ApiProperty({ format: 'uuid' }) merchant_id: string;
  @ApiProperty() store_name: string;
  @ApiProperty({ example: 'active' }) status: string;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  joined_at: Date | null;
}

export class MentorProductAssignmentDto {
  @ApiProperty({ format: 'uuid' }) product_id: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: ['digital'] }) type: 'digital';
  @ApiProperty() role: string;
  @ApiProperty() sort_order: number;
}

export class MentorClassAssignmentDto {
  @ApiProperty({ format: 'uuid', description: 'Tutor assignment id' })
  id: string;
  @ApiProperty({ format: 'uuid' }) class_id: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: classKinds }) type: ClassKind;
  @ApiProperty() status: string;
  @ApiProperty({ format: 'uuid' }) merchant_id: string;
  @ApiProperty() store_name: string;
  @ApiProperty({ enum: TUTOR_ROLES }) role: string;
  @ApiProperty({
    type: 'object',
    description: 'Areas × actions (lihat, tambah, edit, delete) booleans',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'boolean' },
    },
  })
  permissions: Record<string, Record<string, boolean>>;
  @ApiProperty({ type: String, format: 'date-time' }) assigned_at: Date;
}

export class MentorAssignmentsResponseDto {
  @ApiProperty({ type: [MentorMerchantAssignmentDto] })
  merchant_assignments: MentorMerchantAssignmentDto[];

  @ApiProperty({ type: [MentorProductAssignmentDto] })
  product_assignments: MentorProductAssignmentDto[];

  @ApiProperty({
    type: [MentorClassAssignmentDto],
    description:
      'Active tutor assignments: class, merchant, role, and permission matrix',
  })
  class_assignments: MentorClassAssignmentDto[];
}

export class PublicMentorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ nullable: true })
  headline: string | null;

  @ApiPropertyOptional({ nullable: true })
  bio: string | null;

  @ApiProperty()
  expertise: string;

  @ApiProperty({ type: [String], example: ['AutoCAD', 'SAP2000'] })
  expertise_list: string[];

  @ApiProperty()
  experience_years: number;

  @ApiProperty()
  education: string;

  @ApiPropertyOptional({ nullable: true })
  portfolio_url: string | null;

  @ApiProperty()
  linkedin_url: string;
}

export class MentorDocumentResponseDto {
  @ApiProperty({ enum: ['cv', 'skill_certificate'] })
  kind: 'cv' | 'skill_certificate';

  @ApiProperty({ format: 'uuid' })
  asset_id: string;

  @ApiProperty()
  filename: string;

  @ApiProperty()
  mime_type: string;

  @ApiProperty()
  size_bytes: number;

  @ApiProperty()
  uploaded_at: Date;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Signed download URL valid for 10 minutes; null for documents stored before S3 storage.',
  })
  download_url: string | null;
}
