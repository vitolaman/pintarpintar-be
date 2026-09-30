import { EntityManager } from 'typeorm';
import { progressSql } from './learning-progress.service';

export interface LearnerMetrics {
  user_id: string;
  progress: number;
  // Null when the class has no meeting that has started.
  attendance_percent: number | null;
  // Null when the learner has no graded submission.
  average_score: number | null;
  started_meetings: number;
  graded_assignments: number;
}

// A meeting has started once its date and time (Asia/Jakarta) are past.
export const MEETING_STARTED_SQL = `(meeting."date" IS NOT NULL AND meeting."time" IS NOT NULL
  AND ((meeting."date" + meeting."time") AT TIME ZONE 'Asia/Jakarta') <= now())`;

// Progress, attendance and grade average of every enrolled learner of a class
// ($1), optionally narrowed to some learners ($2). Progress, grades, the
// attendance summary and certificate eligibility all read these numbers.
const LEARNER_METRICS_SQL = `
  WITH learners AS (
    SELECT enrollment.user_id FROM enrollments enrollment
    WHERE enrollment.class_id = $1 AND enrollment.deleted_at IS NULL
      AND ($2::uuid[] IS NULL OR enrollment.user_id = ANY($2::uuid[]))
  ), started_meetings AS (
    SELECT meeting.id FROM meetings meeting
    WHERE meeting.class_id = $1 AND meeting.deleted_at IS NULL AND ${MEETING_STARTED_SQL}
  )
  SELECT learners.user_id,
         ${progressSql('learners.user_id', '$1::uuid')} AS progress,
         CASE WHEN (SELECT count(*) FROM started_meetings) = 0 THEN NULL
              ELSE round((SELECT count(*) FROM attendances attendance
                          WHERE attendance.user_id = learners.user_id AND attendance.deleted_at IS NULL
                            AND attendance.status = 'hadir'
                            AND attendance.meeting_id IN (SELECT id FROM started_meetings)) * 100.0
                         / (SELECT count(*) FROM started_meetings), 1) END AS attendance_percent,
         graded.average_score,
         (SELECT count(*) FROM started_meetings)::integer AS started_meetings,
         COALESCE(graded.graded_assignments, 0)::integer AS graded_assignments
  FROM learners
  LEFT JOIN LATERAL (
    SELECT round(avg(submission.total_score), 1) AS average_score,
           count(*) AS graded_assignments
    FROM submissions submission
    INNER JOIN assignments assignment
      ON assignment.id = submission.assignment_id AND assignment.deleted_at IS NULL
    WHERE assignment.class_id = $1 AND submission.user_id = learners.user_id
      AND submission.deleted_at IS NULL AND submission.total_score IS NOT NULL
  ) graded ON true
`;

export async function loadLearnerMetrics(
  manager: EntityManager,
  classId: string,
  userIds?: string[],
): Promise<LearnerMetrics[]> {
  const rows = await manager.query(LEARNER_METRICS_SQL, [
    classId,
    userIds?.length ? userIds : null,
  ]);
  return rows.map((row) => ({
    user_id: row.user_id,
    progress: Number(row.progress),
    attendance_percent:
      row.attendance_percent === null ? null : Number(row.attendance_percent),
    average_score:
      row.average_score === null ? null : Number(row.average_score),
    started_meetings: row.started_meetings,
    graded_assignments: row.graded_assignments,
  }));
}
