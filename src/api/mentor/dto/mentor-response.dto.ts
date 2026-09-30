import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty()
  phone: string;

  @ApiPropertyOptional()
  headline: string | null;

  @ApiPropertyOptional()
  bio: string | null;

  @ApiProperty()
  expertise: string;

  @ApiProperty({ type: [String], example: ['AutoCAD', 'SAP2000'] })
  expertise_list: string[];

  @ApiProperty()
  experience_years: number;

  @ApiProperty()
  education: string;

  @ApiPropertyOptional()
  portfolio_url: string | null;

  @ApiProperty()
  linkedin_url: string;

  @ApiProperty()
  cv_asset_id: string;

  @ApiProperty()
  skill_certificate_asset_id: string;
}

export class MentorAssignmentsResponseDto {
  @ApiProperty({ type: [Object] })
  merchant_assignments: Array<Record<string, unknown>>;

  @ApiProperty({ type: [Object] })
  product_assignments: Array<Record<string, unknown>>;
}

export class PublicMentorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  headline: string | null;

  @ApiPropertyOptional()
  bio: string | null;

  @ApiProperty()
  expertise: string;

  @ApiProperty({ type: [String], example: ['AutoCAD', 'SAP2000'] })
  expertise_list: string[];

  @ApiProperty()
  experience_years: number;

  @ApiProperty()
  education: string;

  @ApiPropertyOptional()
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
    description:
      'Signed download URL valid for 10 minutes; null for documents stored before S3 storage.',
  })
  download_url: string | null;
}
