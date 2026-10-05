import { EntityManager } from 'typeorm';
import { EmailToQueue, guardEmailQueue, queueEmails } from '../email-queue';

export type MeetingEvent = 'created' | 'updated' | 'cancelled';

interface MeetingRow {
  id: string;
  title: string;
  starts_at: Date | null;
  duration_minutes: number | null;
  live_url: string | null;
  class_title: string;
  class_type: string;
}

interface LearnerRow {
  user_id: string;
  name: string;
  email: string;
}

// A meeting's start is its date and time in Asia/Jakarta.
const MEETING_SELECT = `SELECT meeting.id, meeting.title,
    CASE WHEN meeting."date" IS NOT NULL AND meeting."time" IS NOT NULL
      THEN (meeting."date" + meeting."time") AT TIME ZONE 'Asia/Jakarta' END AS starts_at,
    meeting.duration_minutes, NULLIF(btrim(meeting."liveUrl"), '') AS live_url,
    class.title AS class_title, class.type AS class_type
  FROM meetings meeting
  INNER JOIN classes class ON class.id = meeting.class_id`;

const DEFAULT_MEETING_MINUTES = 180;

/**
 * Reads a meeting as the emails show it; call before a delete. It runs under
 * the email guard, so a failed read returns null instead of failing the
 * meeting change.
 */
export async function loadMeetingForEmail(
  manager: EntityManager,
  meetingId: string,
): Promise<MeetingRow | null> {
  let meeting: MeetingRow | null = null;
  await guardEmailQueue(manager, 'meeting read', async (manager) => {
    const [row]: MeetingRow[] = await manager.query(
      `${MEETING_SELECT} WHERE meeting.id = $1`,
      [meetingId],
    );
    meeting = row ?? null;
  });
  return meeting;
}

/**
 * Emails every learner enrolled in the meeting's bootcamp. `version` makes
 * each change its own event; `previous` is the meeting before an update.
 */
export async function queueMeetingEmails(
  manager: EntityManager,
  event: MeetingEvent,
  meeting: MeetingRow | null,
  version: string,
  previous?: MeetingRow | null,
): Promise<void> {
  await guardEmailQueue(manager, `meeting ${event}`, async (manager) => {
    // Only bootcamp meetings with a set time are announced.
    if (
      !meeting?.starts_at ||
      meeting.class_type !== 'live-bootcamp' ||
      new Date(meeting.starts_at).getTime() <= Date.now()
    ) {
      return;
    }
    const learners: LearnerRow[] = await manager.query(
      `SELECT DISTINCT learner.id AS user_id, learner.name, learner.email
       FROM meetings meeting
       INNER JOIN enrollments enrollment
         ON enrollment.class_id = meeting.class_id AND enrollment.deleted_at IS NULL
       INNER JOIN users learner ON learner.id = enrollment.user_id AND learner.deleted_at IS NULL
       WHERE meeting.id = $1`,
      [meeting.id],
    );
    const startsAt = new Date(meeting.starts_at);
    const emails: EmailToQueue[] = learners.map((learner) => ({
      kind: `meeting_${event}`,
      to: learner.email,
      userId: learner.user_id,
      dedupeKey: `meeting:${meeting.id}:${event}:${version}:${learner.user_id}`,
      payload: {
        learner_name: learner.name,
        class_title: meeting.class_title,
        meeting_title: meeting.title,
        starts_at: startsAt.toISOString(),
        previous_starts_at: previous?.starts_at
          ? new Date(previous.starts_at).toISOString()
          : null,
        duration_minutes: meeting.duration_minutes ?? DEFAULT_MEETING_MINUTES,
        live_url: meeting.live_url,
      },
      expiresAt: startsAt,
    }));
    await queueEmails(manager, emails);
  });
}

export interface ReminderRow {
  meeting_id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'mentor' | 'learner';
  title: string;
  starts_at: Date;
  duration_minutes: number | null;
  live_url: string | null;
  class_title: string;
}

// Bootcamp meetings starting in more than 10 and at most 60 minutes, with
// their mentor and enrolled learners; a user who is both is the mentor.
const DUE_REMINDERS_SQL = `
  WITH due AS (
    SELECT meeting.id, meeting.title, meeting.duration_minutes, meeting.mentor_id,
           meeting.class_id, class.title AS class_title,
           NULLIF(btrim(meeting."liveUrl"), '') AS live_url,
           (meeting."date" + meeting."time") AT TIME ZONE 'Asia/Jakarta' AS starts_at
    FROM meetings meeting
    INNER JOIN classes class
      ON class.id = meeting.class_id AND class.deleted_at IS NULL AND class.type = 'live-bootcamp'
    WHERE meeting.deleted_at IS NULL AND meeting."date" IS NOT NULL AND meeting."time" IS NOT NULL
      AND (meeting."date" + meeting."time") AT TIME ZONE 'Asia/Jakarta' > now() + interval '10 minutes'
      AND (meeting."date" + meeting."time") AT TIME ZONE 'Asia/Jakarta' <= now() + interval '60 minutes'
  ), recipients AS (
    SELECT due.id AS meeting_id, mentor_user.id AS user_id, mentor_user.name, mentor_user.email,
           'mentor' AS role, 0 AS rank
    FROM due
    INNER JOIN mentors mentor ON mentor.id = due.mentor_id AND mentor.deleted_at IS NULL
    INNER JOIN users mentor_user ON mentor_user.id = mentor.user_id AND mentor_user.deleted_at IS NULL
    UNION ALL
    SELECT due.id, learner.id, learner.name, learner.email, 'learner', 1
    FROM due
    INNER JOIN enrollments enrollment
      ON enrollment.class_id = due.class_id AND enrollment.deleted_at IS NULL
    INNER JOIN users learner ON learner.id = enrollment.user_id AND learner.deleted_at IS NULL
  )
  SELECT DISTINCT ON (recipients.meeting_id, recipients.user_id)
         recipients.meeting_id, recipients.user_id, recipients.name, recipients.email, recipients.role,
         due.title, due.starts_at, due.duration_minutes, due.live_url, due.class_title
  FROM recipients
  INNER JOIN due ON due.id = recipients.meeting_id
  ORDER BY recipients.meeting_id, recipients.user_id, recipients.rank`;

/**
 * One reminder email per recipient and start time; the key repeats on every
 * run inside the window, so only the first queues it, and a moved meeting
 * gets a new key.
 */
export function reminderEmail(row: ReminderRow): EmailToQueue {
  const startsAt = new Date(row.starts_at);
  return {
    kind:
      row.role === 'mentor' ? 'meeting_mentor_reminder' : 'meeting_reminder',
    to: row.email,
    userId: row.user_id,
    dedupeKey: `meeting:${row.meeting_id}:reminder:${startsAt.toISOString()}:${row.user_id}`,
    payload: {
      learner_name: row.name,
      class_title: row.class_title,
      meeting_title: row.title,
      starts_at: startsAt.toISOString(),
      previous_starts_at: null,
      duration_minutes: row.duration_minutes ?? DEFAULT_MEETING_MINUTES,
      live_url: row.live_url,
    },
    expiresAt: startsAt,
  };
}

/** Queues the reminders that are due now; returns how many were considered. */
export async function queueDueMeetingReminders(
  manager: EntityManager,
): Promise<number> {
  let considered = 0;
  await guardEmailQueue(manager, 'meeting reminder', async (manager) => {
    const rows: ReminderRow[] = await manager.query(DUE_REMINDERS_SQL);
    considered = rows.length;
    await queueEmails(manager, rows.map(reminderEmail));
  });
  return considered;
}

/** True when a change matters to learners: time, duration or link. */
export function meetingScheduleChanged(
  before: MeetingRow | null,
  after: MeetingRow | null,
): boolean {
  if (!before || !after) return false;
  const time = (row: MeetingRow) =>
    row.starts_at ? new Date(row.starts_at).getTime() : null;
  return (
    time(before) !== time(after) ||
    before.duration_minutes !== after.duration_minutes ||
    before.live_url !== after.live_url
  );
}

interface GradeRow {
  user_id: string;
  name: string;
  email: string;
  class_title: string;
  assignment_title: string;
  score: string | null;
  feedback: string | null;
}

export async function queueSubmissionGradedEmail(
  manager: EntityManager,
  submissionId: string,
  gradeVersion: string,
): Promise<void> {
  await guardEmailQueue(manager, 'submission graded', async (manager) => {
    const [row]: GradeRow[] = await manager.query(
      `SELECT learner.id AS user_id, learner.name, learner.email,
              class.title AS class_title, assignment.title AS assignment_title,
              submission.total_score AS score,
              NULLIF(btrim(submission.feedback), '') AS feedback
       FROM submissions submission
       INNER JOIN assignments assignment ON assignment.id = submission.assignment_id
       INNER JOIN classes class ON class.id = assignment.class_id
       INNER JOIN users learner ON learner.id = submission.user_id AND learner.deleted_at IS NULL
       WHERE submission.id = $1`,
      [submissionId],
    );
    if (!row || row.score === null) return;
    await queueEmails(manager, [
      {
        kind: 'submission_graded',
        to: row.email,
        userId: row.user_id,
        dedupeKey: `submission:${submissionId}:graded:${gradeVersion}`,
        payload: {
          learner_name: row.name,
          class_title: row.class_title,
          assignment_title: row.assignment_title,
          score: Number(row.score),
          // Assignments have no maximum score.
          max_score: null,
          graded_at: new Date().toISOString(),
          feedback: row.feedback,
        },
      },
    ]);
  });
}

interface CertificateRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  class_title: string;
  certificate_number: string | null;
  store_name: string;
}

export async function queueCertificateIssuedEmail(
  manager: EntityManager,
  certificateId: string,
): Promise<void> {
  await guardEmailQueue(manager, 'certificate issued', async (manager) => {
    const [row]: CertificateRow[] = await manager.query(
      `SELECT certificate.id, learner.id AS user_id, learner.name, learner.email,
              class.title AS class_title, certificate."certNo" AS certificate_number,
              merchant.store_name
       FROM certificates certificate
       INNER JOIN classes class ON class.id = certificate.class_id
       INNER JOIN merchants merchant ON merchant.id = class.merchant_id
       INNER JOIN users learner ON learner.id = certificate.user_id AND learner.deleted_at IS NULL
       WHERE certificate.id = $1 AND certificate.status = 'issued'`,
      [certificateId],
    );
    if (!row?.certificate_number) return;
    await queueEmails(manager, [
      {
        kind: 'certificate_issued',
        to: row.email,
        userId: row.user_id,
        dedupeKey: `certificate:${row.id}:issued`,
        payload: {
          learner_name: row.name,
          class_title: row.class_title,
          certificate_number: row.certificate_number,
          store_name: row.store_name,
          issued_at: new Date().toISOString(),
        },
      },
    ]);
  });
}
