import {
  FRONTEND_PATHS,
  greeting,
  infoRows,
  paragraph,
  smallPrint,
  strong,
  wib,
} from './layout';
import type { InterviewScheduledEmail } from './payloads';
import type { EmailTemplate } from './template';

export const interviewScheduled: EmailTemplate<InterviewScheduledEmail> = (
  interview,
  link,
) => {
  const title = interview.rescheduled
    ? 'Jadwal wawancara diubah'
    : 'Jadwal wawancara';
  const lead = interview.rescheduled
    ? 'Jadwal wawancara kamu diubah untuk posisi'
    : 'Kamu diundang wawancara untuk posisi';
  const job = strong(interview.job_title);
  const store = strong(interview.store_name);
  const when = wib(interview.interview_at);
  return {
    subject: `${title}: ${interview.job_title}`,
    title,
    preheader: `Wawancara ${when}.`,
    blocks: [
      greeting(interview.applicant_name),
      paragraph(
        `${lead} ${job.html} di ${store.html}.`,
        `${lead} ${job.text} di ${store.text}.`,
      ),
      infoRows([
        // A reschedule reads old to new, like a moved session.
        ...(interview.rescheduled && interview.previous_interview_at
          ? ([
              ['Jadwal sebelumnya', wib(interview.previous_interview_at)],
              ['Jadwal baru', when],
            ] as Array<[string, string]>)
          : ([['Tanggal', when]] as Array<[string, string]>)),
        [
          'Tautan wawancara',
          interview.interview_url ?? 'Akan dikirim oleh merchant',
        ],
      ]),
      smallPrint(
        'Simpan email ini dan bergabunglah beberapa menit sebelum waktu wawancara.',
      ),
    ],
    button: interview.interview_url
      ? { label: 'Buka tautan wawancara', url: interview.interview_url }
      : {
          label: 'Lihat progres lamaran',
          url: link(FRONTEND_PATHS.applications),
        },
  };
};
