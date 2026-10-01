// SQL fragments shared by every meeting read. They expect the meeting row to
// be aliased `meeting`.

// A meeting has started once its date and time (Asia/Jakarta) are past.
export const MEETING_STARTED_SQL = `(meeting."date" IS NOT NULL AND meeting."time" IS NOT NULL
  AND ((meeting."date" + meeting."time") AT TIME ZONE 'Asia/Jakarta') <= now())`;

// A meeting without a duration is treated as three hours long.
export const DEFAULT_MEETING_MINUTES = 180;

export const MEETING_END_SQL = `(((meeting."date" + meeting."time") AT TIME ZONE 'Asia/Jakarta')
  + make_interval(mins => COALESCE(meeting.duration_minutes, ${DEFAULT_MEETING_MINUTES})))`;

// The stored `meetings.status` column is never updated, so responses derive
// the status instead. A meeting without a date or time stays upcoming.
export const MEETING_STATUS_SQL = `CASE WHEN meeting."date" IS NOT NULL AND meeting."time" IS NOT NULL
  AND ${MEETING_END_SQL} < now() THEN 'completed' ELSE 'upcoming' END`;

// Only live bootcamps have meetings. Reads join through this so a meeting of
// a video or deleted class is never shown or counted.
export const BOOTCAMP_MEETING_SQL = `INNER JOIN classes meeting_class
  ON meeting_class.id = meeting.class_id AND meeting_class.deleted_at IS NULL
  AND meeting_class.type = 'live-bootcamp'`;

// The meeting's mentor as `{ id, name }`, or null when none is set or the
// mentor or their account was removed.
export const MEETING_MENTOR_JOIN_SQL = `LEFT JOIN mentors meeting_mentor
  ON meeting_mentor.id = meeting.mentor_id AND meeting_mentor.deleted_at IS NULL
  LEFT JOIN users meeting_mentor_user
  ON meeting_mentor_user.id = meeting_mentor.user_id AND meeting_mentor_user.deleted_at IS NULL`;

export const MEETING_MENTOR_SQL = `CASE WHEN meeting_mentor_user.id IS NULL THEN NULL
  ELSE json_build_object('id', meeting_mentor.id, 'name', meeting_mentor_user.name) END`;

export interface MeetingMentor {
  id: string;
  name: string;
}
