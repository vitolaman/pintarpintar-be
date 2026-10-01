// Roles offered by the onboarding pop-up after signup. Choosing one never
// grants the mentor or merchant role.
export const ONBOARDING_ROLES = [
  'mahasiswa',
  'content_creator',
  'professional',
  'ibu_rumah_tangga',
  'brand_bisnis',
  'custom',
] as const;

export type OnboardingRole = (typeof ONBOARDING_ROLES)[number];

export const MAX_ONBOARDING_SKILLS = 20;
export const MAX_ONBOARDING_SKILL_LENGTH = 50;
