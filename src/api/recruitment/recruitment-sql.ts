// The public board shows active vacancies of active merchants only. Expects
// the vacancy aliased `job` and its merchant `merchant`.
export const PUBLIC_JOB_SQL = `job.deleted_at IS NULL AND job.status = 'active'
  AND merchant.status = 'active' AND merchant.deleted_at IS NULL`;

// The user's mentor id while their mentor account is active, otherwise null.
// Expects the user's mentor record left-joined as `mentor`.
export const ACTIVE_MENTOR_ID_SQL = `CASE WHEN mentor.status = 'active' THEN mentor.id END`;
