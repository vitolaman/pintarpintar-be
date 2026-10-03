import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { assetFieldDescription } from '~/api/file-asset/asset-purpose-rules';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';
import { MentorRegistrationDto } from './mentor-registration.dto';

const CV_DESCRIPTION = assetFieldDescription('application_cv', 'Your CV.');
const CERTIFICATE_DESCRIPTION = assetFieldDescription(
  'certificate_file',
  'Your skill certificate (Sertifikasi Keahlian).',
);

export class MentorRegisterDto extends MentorRegistrationDto {
  @ApiProperty({ format: 'uuid', description: CV_DESCRIPTION })
  @IsUUID()
  cv_asset_id: string;

  @ApiProperty({ format: 'uuid', description: CERTIFICATE_DESCRIPTION })
  @IsUUID()
  skill_certificate_asset_id: string;
}

// Either document may be replaced alone; at least one is required.
export class UpdateMentorDocumentsDto {
  @ApiPropertyOptional({ format: 'uuid', description: CV_DESCRIPTION })
  @OptionalNotNull()
  @IsUUID()
  cv_asset_id?: string;

  @ApiPropertyOptional({ format: 'uuid', description: CERTIFICATE_DESCRIPTION })
  @OptionalNotNull()
  @IsUUID()
  skill_certificate_asset_id?: string;
}
