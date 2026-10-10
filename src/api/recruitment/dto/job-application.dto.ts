import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  ClearableText,
  EnumInput,
  QueryFilter,
  RequiredText,
} from '~/common/decorator/input.decorator';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import {
  APPLICATION_STATUSES,
  ApplicationStatus,
} from '../recruitment.constants';
import { JobClassDto, JobMerchantDto } from './job-posting.dto';
import { assetFieldDescription } from '~/api/file-asset/asset-purpose-rules';

const WEB_URL = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
};

// An instant with an explicit offset, e.g. 2026-11-15T10:00:00+07:00, so the
// stored interview time is unambiguous.
const ISO_WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;

export class ApplyJobDto {
  @RequiredText({ max: 150, example: 'Budi Santoso, S.T.' })
  name: string;

  @RequiredText({ max: 255, example: 'budi@example.com' })
  @IsEmail()
  email: string;

  @RequiredText({
    max: 32,
    example: '+62 812-3456-7890',
    description: 'WhatsApp',
  })
  phone: string;

  @ClearableText({
    max: 500,
    example: 'https://linkedin.com/in/budi',
    description:
      'Optional; an http or https URL when sent. Blank or null means none.',
  })
  @IsUrl(WEB_URL)
  linkedin_url?: string | null;

  @ApiProperty({
    format: 'uuid',
    description: assetFieldDescription(
      'application_cv',
      'The CV registered on your mentor profile is also accepted.',
    ),
  })
  @IsUUID()
  cv_asset_id: string;

  @ClearableText({
    max: 2000,
    example: 'Saya sudah mengajar AutoCAD 5 tahun.',
  })
  note?: string | null;
}

export class ScheduleInterviewDto {
  @ApiProperty({
    example: '2026-11-15T10:00:00+07:00',
    description: 'ISO 8601 with an offset',
  })
  @IsISO8601({ strict: true })
  @Matches(ISO_WITH_OFFSET, { message: 'interview_at must include an offset' })
  interview_at: string;

  @RequiredText({ max: 500, example: 'https://meet.google.com/abc-defg-hij' })
  @IsUrl(WEB_URL)
  interview_url: string;
}

export class MyApplicationQueryDto extends RequestPaginatedQueryDto {
  @EnumInput(APPLICATION_STATUSES, { presence: 'filter' })
  status?: ApplicationStatus;
}

export class ApplicantQueryDto extends MyApplicationQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'One vacancy only. A blank value means no filter.',
  })
  @QueryFilter()
  @IsOptional()
  @IsUUID()
  job_id?: string;

  @ApiPropertyOptional({
    description:
      'Matches name, email or vacancy title (literal). A blank value means no filter.',
  })
  @QueryFilter()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class ApplicationCountsDto {
  @ApiProperty() all: number;
  @ApiProperty() review: number;
  @ApiProperty() interview: number;
  @ApiProperty() accepted: number;
  @ApiProperty() rejected: number;
}

export class ApplicationJobDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() title: string;
  @ApiProperty({ description: 'Kategori Spesialisasi label' })
  category: string;
}

class ApplicationProgressFields {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: APPLICATION_STATUSES }) status: ApplicationStatus;
  @ApiProperty({ description: 'Applied time' }) created_at: Date;
  @ApiPropertyOptional({ nullable: true }) interview_at: Date | null;
  @ApiPropertyOptional({ nullable: true }) interview_url: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Time of the latest accept or reject',
  })
  decided_at: Date | null;
}

export class MyApplicationResponseDto extends ApplicationProgressFields {
  @ApiProperty({ type: ApplicationJobDto }) job: ApplicationJobDto;
  @ApiProperty({ type: JobMerchantDto }) merchant: JobMerchantDto;
  @ApiPropertyOptional({ type: JobClassDto, nullable: true })
  class: JobClassDto | null;
}

export class MyApplicationListResponseDto {
  @ApiProperty({ type: ApplicationCountsDto }) counts: ApplicationCountsDto;
  @ApiProperty({ type: [MyApplicationResponseDto] })
  applications: MyApplicationResponseDto[];
}

export class ApplicantJobDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() title: string;
}

export class ApplicationCvDto {
  @ApiProperty() filename: string;
  @ApiProperty({ description: 'Bytes' }) size: number;
}

export class ApplicantResponseDto extends ApplicationProgressFields {
  @ApiProperty({ format: 'uuid' }) user_id: string;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'mentors.id while the user has an active mentor account, otherwise null',
  })
  mentor_id: string | null;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ description: 'WhatsApp' }) phone: string;
  @ApiPropertyOptional({ nullable: true, description: 'Null when not given' })
  linkedin_url: string | null;
  @ApiPropertyOptional({ nullable: true }) note: string | null;
  @ApiPropertyOptional({ nullable: true }) avatar_url: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: "From the applicant's user profile, when set",
  })
  headline: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'From the mentor profile, when there is one',
  })
  experience_years: number | null;
  @ApiProperty({ type: ApplicantJobDto }) job: ApplicantJobDto;
  @ApiProperty({ type: ApplicationCvDto }) cv: ApplicationCvDto;
}

export class ApplicantListResponseDto {
  @ApiProperty({ type: ApplicationCountsDto }) counts: ApplicationCountsDto;
  @ApiProperty({ type: [ApplicantResponseDto] })
  applicants: ApplicantResponseDto[];
}

export class ApplicantCvLinkDto {
  @ApiProperty() filename: string;
  @ApiProperty({ description: 'Signed download link, valid 10 minutes' })
  download_url: string;
}
