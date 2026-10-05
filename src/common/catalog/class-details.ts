// Values offered by the merchant create-class form and the catalog filters.
export const classCategories = [
  'Coding',
  'Elektro',
  'Mesin',
  'Desain',
  'Sipil',
  'Kimia',
] as const;

export type ClassCategory = (typeof classCategories)[number];

export const learningLevels = ['Pemula', 'Menengah', 'Mahir'] as const;

export type LearningLevel = (typeof learningLevels)[number];

export const MAX_LEARNING_OUTCOMES = 20;
