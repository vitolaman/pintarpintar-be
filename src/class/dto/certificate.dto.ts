import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsUrl,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import {
  ClearableText,
  EnumInput,
  NumberInput,
} from '~/common/decorator/input.decorator';
import { assetFieldDescription } from '../../api/file-asset/asset-purpose-rules';
import {
  NUMBER_PREFIX_PATTERN,
  NUMBER_PREFIX_RULE,
} from '../certificate-number';
import { CERTIFICATE_DELIVERY_MODES } from '../certificate-settings';

const DELIVERY_VALUES = ['template', 'link', 'file'] as const;

const DEPRECATED_RULE =
  'Deprecated: saved and returned, no effect (certificates have no requirements; the merchant issues them)';

export class UpdateCertificateSettingsDto {
  // Still accepted while the frontend sends them (owner decision 2026-10-23).
  @ApiPropertyOptional({ deprecated: true, description: DEPRECATED_RULE })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  auto_issue?: boolean;

  @NumberInput({ presence: 'optional', integer: true, min: 0, max: 100 })
  @ApiPropertyOptional({ deprecated: true, description: DEPRECATED_RULE })
  min_attendance_percent?: number;

  @NumberInput({ presence: 'optional', integer: true, min: 0, max: 100 })
  @ApiPropertyOptional({ deprecated: true, description: DEPRECATED_RULE })
  min_score?: number;

  @EnumInput(CERTIFICATE_DELIVERY_MODES, {
    presence: 'optional',
    description:
      "template = the Pintar Pintar certificate; link = the merchant's own link (needs certificate_url)",
  })
  delivery_mode?: (typeof CERTIFICATE_DELIVERY_MODES)[number];

  @ClearableText({
    max: 2_048,
    example: 'https://drive.google.com/drive/folders/example',
    description:
      'The link learners open in link mode; "" or null clears it (not allowed while in link mode)',
  })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'certificate_url must be an http or https link' },
  )
  certificate_url?: string | null;

  @ClearableText({
    max: 20,
    example: 'CIVIL',
    description: `Numbers become PREFIX-0001, counted per class; empty keeps PP-CERT-YYYY-NNNN. Allowed: ${NUMBER_PREFIX_RULE}`,
  })
  @Matches(NUMBER_PREFIX_PATTERN, {
    message: `number_prefix may contain ${NUMBER_PREFIX_RULE}`,
  })
  number_prefix?: string | null;

  @ClearableText({
    max: 150,
    example: 'Civil Mastery',
    description:
      'Class name on the certificate only, not the catalog title; empty uses the class title',
  })
  class_name?: string | null;

  @ClearableText({
    max: 150,
    example: 'Ir. Rexi Bara, S.T.',
    description:
      "Mentor name on the certificate, titles allowed; empty uses the class's first mentor",
  })
  mentor_name?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: assetFieldDescription(
      'certificate_signature',
      'The signature on the certificate; null clears it.',
    ),
  })
  @IsOptional()
  @IsUUID()
  signature_asset_id?: string | null;

  @ApiPropertyOptional({ description: "Show the learner's final score" })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  show_score?: boolean;
}

// The former issuing rules, still saved and returned with no effect.
export class CertificateRulesDto {
  @ApiProperty({
    default: false,
    deprecated: true,
    description: DEPRECATED_RULE,
  })
  auto_issue: boolean;
  @ApiProperty({ default: 80, deprecated: true, description: DEPRECATED_RULE })
  min_attendance_percent: number;
  @ApiProperty({ default: 75, deprecated: true, description: DEPRECATED_RULE })
  min_score: number;
}

export class CertificateSettingsDto extends CertificateRulesDto {
  @ApiProperty({ enum: CERTIFICATE_DELIVERY_MODES, default: 'template' })
  delivery_mode: string;
  @ApiPropertyOptional({ nullable: true }) certificate_url: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'CIVIL' })
  number_prefix: string | null;
  @ApiPropertyOptional({ nullable: true }) class_name: string | null;
  @ApiPropertyOptional({ nullable: true }) mentor_name: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  signature_asset_id: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Signed link valid 10 minutes',
  })
  signature_url: string | null;
  @ApiProperty({ default: false }) show_score: boolean;
  @ApiProperty({
    description: 'The class title, used when class_name is empty',
  })
  default_class_name: string;
  @ApiPropertyOptional({
    nullable: true,
    description:
      "The class's first mentor, used when mentor_name is empty; null without mentors",
  })
  default_mentor_name: string | null;
}

// What the frontend draws on a template certificate.
export class CertificateTemplateDto {
  @ApiProperty({ example: 'CIVIL-0001' }) cert_no: string;
  @ApiProperty({ example: '2026-10-12' }) issue_date: string;
  @ApiProperty() learner_name: string;
  @ApiProperty({ description: 'The class_name setting, or the class title' })
  class_name: string;
  @ApiProperty() merchant_name: string;
  @ApiPropertyOptional({ nullable: true, description: 'Public store logo' })
  merchant_logo_url: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: "The mentor_name setting, or the class's first mentor",
  })
  mentor_name: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Signed link valid 10 minutes',
  })
  signature_url: string | null;
  @ApiProperty() show_score: boolean;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Average of graded assignments; null when hidden or ungraded',
  })
  final_score: number | null;
  @ApiProperty({
    format: 'uuid',
    description: 'For the QR code: GET /api/v1/certificates/verify/{code}',
  })
  verification_code: string;
}

export class AttachCertificateFileDto {
  @ApiProperty({
    format: 'uuid',
    description: assetFieldDescription('certificate_file'),
  })
  @IsUUID()
  asset_id: string;
}

export class CertificateViewDto {
  @ApiProperty({
    enum: ['issued', 'pending'],
    description:
      'issued = sent; pending = not sent yet: the owner or a tutor with sertifikat.tambah can send it at any time',
  })
  status: string;
  @ApiPropertyOptional({ nullable: true, example: 'PP-CERT-2026-0001' })
  cert_no: string | null;
  @ApiPropertyOptional({ nullable: true }) issue_date: string | null;
  @ApiPropertyOptional({ nullable: true }) file_name: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Signed link valid 10 minutes',
  })
  file_download_url: string | null;
  @ApiPropertyOptional({
    enum: DELIVERY_VALUES,
    nullable: true,
    description:
      'How the issued certificate is opened: link = certificate_url, file = file_download_url, template = draw it from template. Null until issued',
  })
  delivery: (typeof DELIVERY_VALUES)[number] | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      "The merchant's link; only for an issued certificate in link mode",
  })
  certificate_url: string | null;
  @ApiPropertyOptional({ type: CertificateTemplateDto, nullable: true })
  template: CertificateTemplateDto | null;
  // Shown so the merchant can decide; they do not gate issuing.
  @ApiProperty() progress: number;
  @ApiPropertyOptional({ nullable: true }) attendance_percent: number | null;
  @ApiPropertyOptional({ nullable: true }) average_score: number | null;
  @ApiProperty({
    description:
      "Assignments of the class with the learner's graded submission",
  })
  graded_assignments: number;
  @ApiProperty({
    description: 'Assignments of the class',
  })
  assignment_count: number;
  @ApiProperty({
    type: CertificateRulesDto,
    deprecated: true,
    description: DEPRECATED_RULE,
  })
  requirements: CertificateRulesDto;
}

export class ClassCertificateLearnerDto extends CertificateViewDto {
  @ApiProperty() user_id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
}
