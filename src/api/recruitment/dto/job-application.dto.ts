import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import { trimOptionalText, trimText } from '~/common/dto/text-transforms';
import {
  APPLICATION_STATUSES,
  ApplicationStatus,
  JOB_CATEGORIES,
  JobCategory,
} from '../recruitment.constants';
import { JobClassDto, JobMerchantDto } from './job-posting.dto';

const WEB_URL = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
};

// An instant with an explicit offset, e.g. 2026-11-15T10:00:00+07:00, so the
// stored interview time is unambiguous.
const ISO_WITH_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;

export class ApplyJobDto {
  @ApiProperty({ example: 'Budi Santoso, S.T.' })
  @Transform(trimText)
  @IsString()
  @Length(1, 150)
  name: string;

  @ApiProperty({ example: 'budi@example.com' })
  @Transform(trimText)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: '+62 812-3456-7890', description: 'WhatsApp' })
  @Transform(trimText)
  @IsString()
  @Length(1, 32)
  phone: string;

  @ApiProperty({ example: 'https://linkedin.com/in/budi' })
  @Transform(trimText)
  @IsUrl(WEB_URL)
  @MaxLength(500)
  linkedin_url: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'A registered upload with purpose application_cv (PDF/DOC/DOCX, at most 10 MB), or the applicant mentor CV asset',
  })
  @IsUUID()
  cv_asset_id: string;

  @ApiPropertyOptional({ example: 'Saya sudah mengajar AutoCAD 5 tahun.' })
  @IsOptional()
  @Transform(trimOptionalText)
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ScheduleInterviewDto {
  @ApiProperty({
    example: '2026-11-15T10:00:00+07:00',
    description: 'ISO 8601 with an offset',
  })
  @IsISO8601({ strict: true })
  @Matches(ISO_WITH_OFFSET, { message: 'interview_at must include an offset' })
  interview_at: string;

  @ApiProperty({ example: 'https://meet.google.com/abc-defg-hij' })
  @Transform(trimText)
  @IsUrl(WEB_URL)
  @MaxLength(500)
  interview_url: string;
}

export class MyApplicationQueryDto extends RequestPaginatedQueryDto {
  @ApiPropertyOptional({ enum: APPLICATION_STATUSES })
  @IsOptional()
  @IsIn(APPLICATION_STATUSES)
  status?: ApplicationStatus;
}

export class ApplicantQueryDto extends MyApplicationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'One vacancy only' })
  @IsOptional()
  @IsUUID()
  job_id?: string;

  @ApiPropertyOptional({
    description: 'Matches name, email or vacancy title (literal)',
  })
  @IsOptional()
  @Transform(trimOptionalText)
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
  @ApiProperty({ enum: JOB_CATEGORIES }) category: JobCategory;
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
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ description: 'WhatsApp' }) phone: string;
  @ApiProperty() linkedin_url: string;
  @ApiPropertyOptional({ nullable: true }) note: string | null;
  @ApiPropertyOptional({ nullable: true }) avatar_url: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'From the mentor profile, when there is one',
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
