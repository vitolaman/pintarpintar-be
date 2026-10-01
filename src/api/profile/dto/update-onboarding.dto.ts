import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { trimText } from '~/common/dto/text-transforms';
import { uniqueSkills } from '~/common/util/skill-list';
import {
  MAX_ONBOARDING_SKILL_LENGTH,
  MAX_ONBOARDING_SKILLS,
  ONBOARDING_ROLES,
  OnboardingRole,
} from '../onboarding.constants';

// Non-string entries are left for the validators to reject.
const toSkillList = ({ value }: { value: unknown }) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? uniqueSkills(value)
    : value;

export class UpdateOnboardingDto {
  @ApiProperty({ enum: ONBOARDING_ROLES, example: 'professional' })
  @IsIn(ONBOARDING_ROLES)
  role: OnboardingRole;

  @ApiPropertyOptional({
    example: 'Konsultan Teknik',
    description: 'Required for role `custom`; ignored otherwise',
  })
  @ValidateIf((input: UpdateOnboardingDto) => input.role === 'custom')
  @Transform(trimText)
  @IsString()
  @Length(1, 60)
  custom_role?: string;

  @ApiProperty({
    type: [String],
    example: ['AutoCAD', 'BIM'],
    description: `Up to ${MAX_ONBOARDING_SKILLS} skills of at most ${MAX_ONBOARDING_SKILL_LENGTH} characters; trimmed, blanks and case-insensitive duplicates removed`,
  })
  @Transform(toSkillList)
  @IsArray()
  @ArrayMaxSize(MAX_ONBOARDING_SKILLS)
  @IsString({ each: true })
  @MaxLength(MAX_ONBOARDING_SKILL_LENGTH, { each: true })
  skills: string[];
}
