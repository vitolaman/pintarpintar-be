import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { EnumInput, RequiredText } from '~/common/decorator/input.decorator';
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
  @EnumInput(ONBOARDING_ROLES, { example: 'professional' })
  role: OnboardingRole;

  @RequiredText({ max: 60, example: 'Konsultan Teknik' })
  @ApiPropertyOptional({
    description: 'Required for role `custom`; ignored otherwise',
  })
  @ValidateIf((input: UpdateOnboardingDto) => input.role === 'custom')
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
