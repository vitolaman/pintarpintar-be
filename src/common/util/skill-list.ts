// Skills are stored as one comma-separated text column (for example
// mentor_profiles.expertise) and exposed to clients as a list.
export const SKILL_SEPARATOR = ', ';

export function splitSkills(text: string | null | undefined): string[] {
  if (!text) return [];
  return uniqueSkills(text.split(','));
}

export function joinSkills(skills: string[]): string {
  return uniqueSkills(skills).join(SKILL_SEPARATOR);
}

// Trims entries, drops blanks, and removes case-insensitive duplicates while
// keeping the first spelling and the given order.
export function uniqueSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of skills) {
    const skill = raw.trim().replace(/\s+/g, ' ');
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    result.push(skill);
  }
  return result;
}
