import {
  EmailContent,
  FRONTEND_PATHS,
  greeting,
  infoRows,
  paragraph,
  strong,
  wib,
} from './layout';
import type { MeetingEmail } from './payloads';
import type { EmailTemplate, Link } from './template';

type MeetingEvent = 'created' | 'updated' | 'cancelled';

const TITLES: Record<MeetingEvent, string> = {
  created: 'Jadwal sesi baru',
  updated: 'Jadwal sesi diubah',
  cancelled: 'Sesi dibatalkan',
};

const LEADS: Record<MeetingEvent, (className: string) => string> = {
  created: (className) => `Ada sesi baru di ${className}.`,
  updated: (className) =>
    `Jadwal sesi di ${className} diubah. Berikut jadwal terbarunya.`,
  cancelled: (className) =>
    `Sesi berikut di ${className} dibatalkan oleh mentor.`,
};

function meetingEmail(
  event: MeetingEvent,
  meeting: MeetingEmail,
  link: Link,
): EmailContent {
  const course = strong(meeting.class_title);
  const rows: Array<[string, string]> = [
    ['Sesi', meeting.meeting_title],
    ['Waktu', wib(meeting.starts_at)],
  ];
  if (event === 'updated' && meeting.previous_starts_at) {
    rows.push(['Jadwal sebelumnya', wib(meeting.previous_starts_at)]);
  }
  rows.push(['Durasi', `${meeting.duration_minutes} menit`]);
  if (event !== 'cancelled') {
    rows.push(['Tautan', meeting.live_url ?? 'Akan dibagikan mentor']);
  }
  const joinable = event !== 'cancelled' && meeting.live_url;
  return {
    subject: `${TITLES[event]}: ${meeting.meeting_title}`,
    title: TITLES[event],
    preheader: `${meeting.meeting_title}, ${wib(meeting.starts_at)}.`,
    blocks: [
      greeting(meeting.learner_name),
      paragraph(LEADS[event](course.html), LEADS[event](course.text)),
      infoRows(rows),
    ],
    button: joinable
      ? { label: 'Gabung sesi', url: meeting.live_url as string }
      : { label: 'Buka Portal Saya', url: link(FRONTEND_PATHS.portal) },
  };
}

export const meetingCreated: EmailTemplate<MeetingEmail> = (meeting, link) =>
  meetingEmail('created', meeting, link);

export const meetingUpdated: EmailTemplate<MeetingEmail> = (meeting, link) =>
  meetingEmail('updated', meeting, link);

export const meetingCancelled: EmailTemplate<MeetingEmail> = (meeting, link) =>
  meetingEmail('cancelled', meeting, link);
