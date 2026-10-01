// Labels of the "Buat Job Posting" form; stored and returned unchanged.
export const JOB_CATEGORIES = [
  'Pemrograman & Teknologi',
  'Desain Teknik & Arsitektur',
  'Pemasaran & Bisnis',
  'Pengembangan Karier & Soft Skill',
  'Lainnya / Multidisiplin',
] as const;

export const CONTRACT_TYPES = ['Part-Time', 'Full-Time'] as const;

export const WORK_TYPES = ['Remote', 'Hybrid', 'On-Site'] as const;

export const JOB_STATUSES = ['active', 'closed'] as const;

export const APPLICATION_STATUSES = [
  'review',
  'interview',
  'accepted',
  'rejected',
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];
export type ContractType = (typeof CONTRACT_TYPES)[number];
export type WorkType = (typeof WORK_TYPES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// A vacancy counts as new on the board for this many days.
export const NEW_JOB_DAYS = 7;
