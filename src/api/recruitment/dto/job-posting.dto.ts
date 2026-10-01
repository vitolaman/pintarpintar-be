import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { OptionalNotNull } from '~/common/decorator/optional-not-null.decorator';
import { RequestPaginatedQueryDto } from '~/common/dto/request-paginated.dto';
import { trimOptionalText, trimText } from '~/common/dto/text-transforms';
import {
  CONTRACT_TYPES,
  ContractType,
  JOB_CATEGORIES,
  JobCategory,
  JobStatus,
  JOB_STATUSES,
  WORK_TYPES,
  WorkType,
} from '../recruitment.constants';

export const MAX_JOB_SKILLS = 20;
export const MAX_SKILL_LENGTH = 50;

// Trims every skill, drops blanks, and keeps the first spelling of
// case-insensitive duplicates. Non-arrays are left for the validators.
const toSkillList = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) return value;
  const seen = new Set<string>();
  const skills: unknown[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      skills.push(item);
      continue;
    }
    const skill = item.trim();
    if (!skill || seen.has(skill.toLowerCase())) continue;
    seen.add(skill.toLowerCase());
    skills.push(skill);
  }
  return skills;
};

export class CreateJobPostingDto {
  @ApiProperty({ example: 'Instruktur Senior AutoCAD & 3D Modeling' })
  @Transform(trimText)
  @IsString()
  @Length(1, 150)
  title: string;

  @ApiProperty({ enum: JOB_CATEGORIES, example: 'Desain Teknik & Arsitektur' })
  @IsIn(JOB_CATEGORIES)
  category: JobCategory;

  @ApiProperty({ enum: CONTRACT_TYPES, example: 'Part-Time' })
  @IsIn(CONTRACT_TYPES)
  contract_type: ContractType;

  @ApiProperty({ enum: WORK_TYPES, example: 'Remote' })
  @IsIn(WORK_TYPES)
  work_type: WorkType;

  @ApiProperty({ example: 'Full Remote (Seluruh Indonesia)' })
  @Transform(trimText)
  @IsString()
  @Length(1, 150)
  location: string;

  @ApiProperty({
    example: 'Rp 5.000.000 - Rp 8.000.000 / bulan',
    description: 'Free text, as entered',
  })
  @Transform(trimText)
  @IsString()
  @Length(1, 100)
  salary: string;

  @ApiProperty({
    example: 'Minimal 3 tahun pengalaman AutoCAD 2024 dan SketchUp.',
  })
  @Transform(trimText)
  @IsString()
  @Length(1, 5000)
  requirements: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['AutoCAD', 'SketchUp', 'BIM'],
    description: `Skill yang Dibutuhkan: at most ${MAX_JOB_SKILLS}, each at most ${MAX_SKILL_LENGTH} characters; trimmed, blanks and case-insensitive duplicates removed`,
  })
  @OptionalNotNull()
  @Transform(toSkillList)
  @IsArray()
  @ArrayMaxSize(MAX_JOB_SKILLS)
  @IsString({ each: true })
  @MaxLength(MAX_SKILL_LENGTH, { each: true })
  skills?: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: "One of the merchant's own classes",
  })
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsUUID()
  class_id?: string | null;
}

// Null is validated, so it is rejected for every field except `class_id`,
// where it clears the link. An empty `skills` array clears the list.
export class UpdateJobPostingDto extends PartialType(CreateJobPostingDto, {
  skipNullProperties: false,
}) {}

export class PublicJobQueryDto extends RequestPaginatedQueryDto {
  @ApiPropertyOptional({
    description: 'Matches title, merchant, category or skills (literal)',
  })
  @IsOptional()
  @Transform(trimOptionalText)
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @ApiPropertyOptional({ example: 'Jakarta' })
  @IsOptional()
  @Transform(trimOptionalText)
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ enum: JOB_CATEGORIES })
  @IsOptional()
  @IsIn(JOB_CATEGORIES)
  category?: JobCategory;

  @ApiPropertyOptional({ enum: CONTRACT_TYPES })
  @IsOptional()
  @IsIn(CONTRACT_TYPES)
  contract_type?: ContractType;

  @ApiPropertyOptional({ enum: WORK_TYPES })
  @IsOptional()
  @IsIn(WORK_TYPES)
  work_type?: WorkType;
}

export class JobMerchantDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) slug: string | null;
  @ApiPropertyOptional({ nullable: true }) logo_url: string | null;
}

export class JobClassDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() title: string;
}

export class JobPostingResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: JOB_CATEGORIES }) category: JobCategory;
  @ApiProperty({ enum: CONTRACT_TYPES }) contract_type: ContractType;
  @ApiProperty({ enum: WORK_TYPES }) work_type: WorkType;
  @ApiProperty() location: string;
  @ApiProperty() salary: string;
  @ApiProperty() requirements: string;
  @ApiProperty({ type: [String] }) skills: string[];
  @ApiProperty({ enum: JOB_STATUSES }) status: JobStatus;
  @ApiProperty({ type: JobMerchantDto }) merchant: JobMerchantDto;
  @ApiPropertyOptional({ type: JobClassDto, nullable: true })
  class: JobClassDto | null;
  @ApiProperty({ description: 'Non-deleted applications' })
  applicants_count: number;
  @ApiProperty({ description: 'Posted within the last 7 days' })
  is_new: boolean;
  @ApiProperty({ description: 'Posted time' }) created_at: Date;
  @ApiPropertyOptional({ nullable: true }) closed_at: Date | null;
}

export class JobBoardResponseDto {
  @ApiProperty({ description: 'Active vacancies of active merchants' })
  active_jobs: number;

  @ApiProperty({ description: 'Distinct merchants with an active vacancy' })
  recruiting_merchants: number;

  @ApiProperty({ type: [JobPostingResponseDto] })
  jobs: JobPostingResponseDto[];
}
