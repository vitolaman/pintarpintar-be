import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { assetFieldDescription } from '../../api/file-asset/asset-purpose-rules';

export class UpdateCertificateSettingsDto {
  @ApiPropertyOptional({ description: 'Issue automatically on eligibility' })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  auto_issue?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(100)
  min_attendance_percent?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(100)
  min_score?: number;
}

export class CertificateSettingsDto {
  @ApiProperty({ default: false }) auto_issue: boolean;
  @ApiProperty({ default: 80 }) min_attendance_percent: number;
  @ApiProperty({ default: 75 }) min_score: number;
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
    enum: ['issued', 'pending', 'ineligible'],
    description: 'pending = Menunggu Verifikasi, ineligible = Belum Syarat',
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
  @ApiProperty() progress: number;
  @ApiPropertyOptional({ nullable: true }) attendance_percent: number | null;
  @ApiPropertyOptional({ nullable: true }) average_score: number | null;
  @ApiProperty({ type: CertificateSettingsDto })
  requirements: CertificateSettingsDto;
}

export class ClassCertificateLearnerDto extends CertificateViewDto {
  @ApiProperty() user_id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
}
