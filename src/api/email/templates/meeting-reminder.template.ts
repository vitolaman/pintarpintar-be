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
    subject: `Reminder: kelas ${meeting.meeting_title} akan dimulai dalam 60 menit`,
    title: 'Kelas akan dimulai dalam 60 menit',
    preheader: `${meeting.meeting_title}, ${wib(meeting.starts_at)}.`,
    blocks: [
      greeting(meeting.learner_name),
      paragraph(
        `Sesi di ${course.html} akan dimulai dalam 60 menit. Siapkan perangkat dan koneksi kamu.`,
        `Sesi di ${course.text} akan dimulai dalam 60 menit. Siapkan perangkat dan koneksi kamu.`,
      ),
      infoRows([
        ['Sesi', meeting.meeting_title],
        ['Tanggal', wib(meeting.starts_at)],
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
    subject: `Reminder: kelas ${meeting.meeting_title} akan dimulai dalam 60 menit`,
    title: 'Kelas akan dimulai dalam 60 menit',
    preheader: `${meeting.meeting_title}, ${wib(meeting.starts_at)}.`,
    blocks: [
      greeting(meeting.learner_name),
      paragraph(
        `Kamu dijadwalkan mengajar sesi di ${course.html} dalam 60 menit.`,
        `Kamu dijadwalkan mengajar sesi di ${course.text} dalam 60 menit.`,
      ),
      infoRows([
        ['Sesi', meeting.meeting_title],
        ['Tanggal', wib(meeting.starts_at)],
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
