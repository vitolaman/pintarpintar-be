import {
  FRONTEND_PATHS,
  greeting,
  infoRows,
  paragraph,
  strong,
  wib,
} from './layout';
import type { MeetingEmail } from './payloads';
import type { EmailTemplate } from './template';

export const meetingReminder: EmailTemplate<MeetingEmail> = (meeting, link) => {
  const course = strong(meeting.class_title);
  return {
    subject: `Sesi dimulai 1 jam lagi: ${meeting.meeting_title}`,
    title: 'Sesi dimulai 1 jam lagi',
    preheader: `${meeting.meeting_title}, ${wib(meeting.starts_at)}.`,
    blocks: [
      greeting(meeting.learner_name),
      paragraph(
        `Sesi di ${course.html} akan dimulai sekitar 1 jam lagi. Siapkan perangkat dan koneksi kamu.`,
        `Sesi di ${course.text} akan dimulai sekitar 1 jam lagi. Siapkan perangkat dan koneksi kamu.`,
      ),
      infoRows([
        ['Sesi', meeting.meeting_title],
        ['Waktu', wib(meeting.starts_at)],
        ['Durasi', `${meeting.duration_minutes} menit`],
      ]),
    ],
    button: meeting.live_url
      ? { label: 'Gabung sesi', url: meeting.live_url }
      : { label: 'Buka Portal Saya', url: link(FRONTEND_PATHS.portal) },
  };
};

export const meetingMentorReminder: EmailTemplate<MeetingEmail> = (
  meeting,
  link,
) => {
  const course = strong(meeting.class_title);
  return {
    subject: `Kamu mengajar 1 jam lagi: ${meeting.meeting_title}`,
    title: 'Kamu mengajar 1 jam lagi',
    preheader: `${meeting.meeting_title}, ${wib(meeting.starts_at)}.`,
    blocks: [
      greeting(meeting.learner_name),
      paragraph(
        `Kamu dijadwalkan mengajar sesi di ${course.html} sekitar 1 jam lagi.`,
        `Kamu dijadwalkan mengajar sesi di ${course.text} sekitar 1 jam lagi.`,
      ),
      infoRows([
        ['Sesi', meeting.meeting_title],
        ['Waktu', wib(meeting.starts_at)],
        ['Durasi', `${meeting.duration_minutes} menit`],
        [
          'Tautan',
          meeting.live_url ?? 'Belum diatur, tambahkan di halaman kelas',
        ],
      ]),
    ],
    button: meeting.live_url
      ? { label: 'Buka tautan sesi', url: meeting.live_url }
      : {
          label: 'Buka dashboard mentor',
          url: link(FRONTEND_PATHS.mentorDashboard),
        },
  };
};
