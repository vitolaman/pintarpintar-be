// The category ("Kategori Spesialisasi") is the label of the form's selector,
// which owns the options, as for the class "Kategori Skill".
export const MAX_JOB_CATEGORY_LENGTH = 64;

export const CONTRACT_TYPES = ['Part-Time', 'Full-Time'] as const;

export const WORK_TYPES = ['Remote', 'Hybrid', 'On-Site'] as const;

export const JOB_STATUSES = ['active', 'closed'] as const;

export const APPLICATION_STATUSES = [
  'review',
  'interview',
  'accepted',
  'rejected',
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];
export type WorkType = (typeof WORK_TYPES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// A vacancy counts as new on the board for this many days.
export const NEW_JOB_DAYS = 7;
